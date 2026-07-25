import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  AUTOMATIC_BACKUP_PREFIX,
  automaticBackupPath,
  isCronRequestAuthorized,
  isExpiredAutomaticBackup,
} from "@/lib/automatic-backup";
import { buildAllOrganizationBackups } from "@/lib/organization-backup-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const UPLOAD_BATCH_SIZE = 10;

async function uploadBackups(
  backups: Awaited<ReturnType<typeof buildAllOrganizationBackups>>,
  startedAt: Date,
) {
  for (let index = 0; index < backups.length; index += UPLOAD_BATCH_SIZE) {
    const batch = backups.slice(index, index + UPLOAD_BATCH_SIZE);
    await Promise.all(
      batch.map((backup) =>
        put(
          automaticBackupPath(backup.organization.code, backup.organization.id, startedAt),
          JSON.stringify(backup),
          {
            access: "private",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "application/json",
          },
        ),
      ),
    );
  }
}

async function removeExpiredBackups(now: Date) {
  const expiredUrls: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix: AUTOMATIC_BACKUP_PREFIX,
      cursor,
      limit: 1_000,
    });

    expiredUrls.push(
      ...page.blobs
        .filter((blob) => isExpiredAutomaticBackup(blob.uploadedAt, now))
        .map((blob) => blob.url),
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  if (expiredUrls.length > 0) {
    await del(expiredUrls);
  }

  return expiredUrls.length;
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Automatic backup is not configured: BLOB_READ_WRITE_TOKEN is missing.");
    return NextResponse.json({ error: "Automatic backup is not configured." }, { status: 503 });
  }

  const startedAt = new Date();

  try {
    const backups = await buildAllOrganizationBackups();
    await uploadBackups(backups, startedAt);

    const removed = await removeExpiredBackups(startedAt);
    console.info("Automatic organization backup completed.", {
      organizations: backups.length,
      removed,
      date: startedAt.toISOString(),
    });

    return NextResponse.json(
      {
        ok: true,
        organizations: backups.length,
        removed,
        completedAt: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Automatic organization backup failed.", error);
    return NextResponse.json(
      { error: "Automatic backup failed." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
