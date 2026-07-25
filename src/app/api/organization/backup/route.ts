import { NextResponse } from "next/server";
import { ensureSchema, sql, sqlTransaction } from "@/lib/db";
import { BackupValidationError, validateOrganizationBackup } from "@/lib/organization-backup";
import { hashPassword } from "@/lib/security";
import {
  authenticateSiteAdmin,
  getSiteAdminClientAddress,
  siteAdminAuthMessage,
  type SiteAdminAuthResult,
} from "@/lib/site-admin";

type BackupRequestBody = {
  action?: "download" | "restore";
  organizationCode?: string;
  siteAdminUsername?: string;
  siteAdminPassword?: string;
  confirmation?: string;
  backup?: unknown;
};

type OrganizationRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
};

async function getOrganization(organizationCode: string) {
  await ensureSchema();
  const code = organizationCode.trim().toUpperCase();
  if (!code) return null;

  const { rows } = await sql`
    SELECT id, name, code, active, created_at
    FROM organizations
    WHERE code = ${code}
    LIMIT 1
  `;
  return (rows[0] as OrganizationRow | undefined) ?? null;
}

function authenticationError(result: SiteAdminAuthResult) {
  return NextResponse.json(
    { error: siteAdminAuthMessage(result) },
    { status: result.status === "locked" ? 429 : 403 },
  );
}

async function buildBackupResponse(organization: OrganizationRow) {
  const [members, events, rsvps] = await Promise.all([
    sql`SELECT id, name, email, role, active, created_at FROM members WHERE organization_id = ${organization.id} ORDER BY created_at ASC`,
    sql`SELECT id, sheet_id, title, description, location, start_at, end_at, created_by, created_at FROM events WHERE organization_id = ${organization.id} ORDER BY start_at ASC`,
    sql`
      SELECT rsvps.event_id, rsvps.user_id, rsvps.status, rsvps.note, rsvps.updated_at
      FROM rsvps
      INNER JOIN events ON events.id = rsvps.event_id
      WHERE events.organization_id = ${organization.id}
      ORDER BY rsvps.updated_at ASC
    `,
  ]);

  return NextResponse.json({
    schemaVersion: 1,
    backupType: "organization",
    exportedAt: new Date().toISOString(),
    organization: {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      active: organization.active,
      created_at: organization.created_at,
    },
    members: members.rows,
    events: events.rows,
    rsvps: rsvps.rows,
  });
}

async function restoreBackup(organization: OrganizationRow, backupInput: unknown) {
  const backup = validateOrganizationBackup(backupInput, organization.code, organization.id);
  const memberIds = JSON.stringify(backup.members.map((member) => member.id));
  const eventIds = JSON.stringify(backup.events.map((event) => event.id));
  const members = JSON.stringify(
    backup.members.map((member) => ({
      ...member,
      password_hash: hashPassword(crypto.randomUUID()),
    })),
  );
  const events = JSON.stringify(backup.events);
  const rsvps = JSON.stringify(backup.rsvps);

  await sqlTransaction((transactionSql) => [
    transactionSql`SELECT pg_advisory_xact_lock(hashtext(${organization.id}))`,
    transactionSql`
      SELECT 1 / CASE
        WHEN EXISTS (
          SELECT 1
          FROM members
          WHERE id IN (SELECT jsonb_array_elements_text(${memberIds}::jsonb))
            AND organization_id <> ${organization.id}
        )
        OR EXISTS (
          SELECT 1
          FROM events
          WHERE id IN (SELECT jsonb_array_elements_text(${eventIds}::jsonb))
            AND organization_id <> ${organization.id}
        )
        THEN 0
        ELSE 1
      END AS organization_scope_valid
    `,
    transactionSql`
      INSERT INTO members (id, organization_id, name, email, password_hash, role, active, created_at)
      SELECT restored.id, ${organization.id}, restored.name, restored.email, restored.password_hash, restored.role, restored.active, restored.created_at
      FROM jsonb_to_recordset(${members}::jsonb) AS restored(
        id TEXT,
        name TEXT,
        email TEXT,
        password_hash TEXT,
        role TEXT,
        active BOOLEAN,
        created_at TIMESTAMPTZ
      )
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          active = EXCLUDED.active,
          created_at = EXCLUDED.created_at
      WHERE members.organization_id = EXCLUDED.organization_id
    `,
    transactionSql`
      INSERT INTO events (id, organization_id, sheet_id, title, description, location, start_at, end_at, created_by, created_at)
      SELECT restored.id, ${organization.id}, restored.sheet_id, restored.title, restored.description, restored.location, restored.start_at, restored.end_at, restored.created_by, restored.created_at
      FROM jsonb_to_recordset(${events}::jsonb) AS restored(
        id TEXT,
        sheet_id TEXT,
        title TEXT,
        description TEXT,
        location TEXT,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        created_by TEXT,
        created_at TIMESTAMPTZ
      )
      ON CONFLICT (id) DO UPDATE
      SET sheet_id = EXCLUDED.sheet_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          created_by = EXCLUDED.created_by,
          created_at = EXCLUDED.created_at
      WHERE events.organization_id = EXCLUDED.organization_id
    `,
    transactionSql`
      INSERT INTO rsvps (event_id, user_id, status, note, updated_at)
      SELECT restored.event_id, restored.user_id, restored.status, restored.note, restored.updated_at
      FROM jsonb_to_recordset(${rsvps}::jsonb) AS restored(
        event_id TEXT,
        user_id TEXT,
        status TEXT,
        note TEXT,
        updated_at TIMESTAMPTZ
      )
      ON CONFLICT (event_id, user_id) DO UPDATE
      SET status = EXCLUDED.status,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at
    `,
  ]);

  return {
    members: backup.members.length,
    events: backup.events.length,
    rsvps: backup.rsvps.length,
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_000_000) {
    return NextResponse.json({ error: "Backup request is too large." }, { status: 413 });
  }

  let body: BackupRequestBody;
  try {
    body = (await request.json()) as BackupRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const authentication = await authenticateSiteAdmin(
    body.siteAdminUsername ?? "",
    body.siteAdminPassword ?? "",
    getSiteAdminClientAddress(request.headers),
  );
  if (!authentication.ok) return authenticationError(authentication);

  const organization = await getOrganization(body.organizationCode ?? "");
  if (!organization) {
    return NextResponse.json({ error: "団体コードを確認してください。" }, { status: 404 });
  }

  if (body.action === "download") {
    return buildBackupResponse(organization);
  }

  if (body.action !== "restore") {
    return NextResponse.json({ error: "Invalid backup action." }, { status: 400 });
  }
  if (body.confirmation !== `${organization.code}:RESTORE`) {
    return NextResponse.json({ error: "Restore confirmation is required." }, { status: 400 });
  }
  if (!body.backup) {
    return NextResponse.json({ error: "Backup file is required." }, { status: 400 });
  }

  try {
    const restored = await restoreBackup(organization, body.backup);
    return NextResponse.json({ ok: true, restored });
  } catch (error) {
    if (error instanceof BackupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Organization backup restore failed.", error);
    return NextResponse.json({ error: "Backup restore failed without changing organization data." }, { status: 409 });
  }
}
