import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import {
  authenticateSiteAdmin,
  getSiteAdminClientAddress,
  siteAdminAuthMessage,
  type SiteAdminAuthResult,
} from "@/lib/site-admin";

type ArchiveRequestBody = {
  action?: "download" | "delete";
  format?: "json" | "csv";
  organizationCode?: string;
  year?: string | number;
  siteAdminUsername?: string;
  siteAdminPassword?: string;
  confirmation?: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
};

type ArchiveEventRow = Record<string, unknown> & {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
};

type ArchiveRsvpRow = Record<string, unknown> & {
  event_id: string;
  user_id: string;
  member_name: string;
  status: string;
  note: string | null;
  updated_at: string;
};

function parseYear(value: string | number | undefined) {
  const year = String(value ?? "").trim();
  return /^\d{4}$/.test(year) ? Number(year) : null;
}

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
  const response = NextResponse.json(
    { error: siteAdminAuthMessage(result) },
    { status: result.status === "locked" ? 429 : 403 },
  );
  if (result.retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds));
  }
  return response;
}

async function getArchiveData(organization: OrganizationRow, year: number) {
  const [members, events, rsvps] = await Promise.all([
    sql`
      SELECT id, name, email, role, active, created_at
      FROM members
      WHERE organization_id = ${organization.id}
        AND (
          id IN (
            SELECT created_by
            FROM events
            WHERE organization_id = ${organization.id}
              AND created_by IS NOT NULL
              AND end_at < NOW()
              AND EXTRACT(YEAR FROM start_at AT TIME ZONE 'Asia/Tokyo') = ${year}
          )
          OR id IN (
            SELECT rsvps.user_id
            FROM rsvps
            INNER JOIN events ON events.id = rsvps.event_id
            WHERE events.organization_id = ${organization.id}
              AND events.end_at < NOW()
              AND EXTRACT(YEAR FROM events.start_at AT TIME ZONE 'Asia/Tokyo') = ${year}
          )
        )
      ORDER BY created_at ASC
    `,
    sql`
      SELECT id, sheet_id, title, description, location, start_at, end_at, created_by, created_at
      FROM events
      WHERE organization_id = ${organization.id}
        AND end_at < NOW()
        AND EXTRACT(YEAR FROM start_at AT TIME ZONE 'Asia/Tokyo') = ${year}
      ORDER BY start_at ASC
    `,
    sql`
      SELECT
        rsvps.event_id,
        rsvps.user_id,
        members.name AS member_name,
        rsvps.status,
        rsvps.note,
        rsvps.updated_at
      FROM rsvps
      INNER JOIN events ON events.id = rsvps.event_id
      INNER JOIN members ON members.id = rsvps.user_id
      WHERE events.organization_id = ${organization.id}
        AND events.end_at < NOW()
        AND EXTRACT(YEAR FROM events.start_at AT TIME ZONE 'Asia/Tokyo') = ${year}
      ORDER BY events.start_at ASC, members.name ASC
    `,
  ]);

  return {
    exportedAt: new Date().toISOString(),
    archive: {
      year,
      timeZone: "Asia/Tokyo",
      completedEventsOnly: true,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      active: organization.active,
      created_at: organization.created_at,
    },
    members: members.rows,
    events: events.rows as ArchiveEventRow[],
    rsvps: rsvps.rows as ArchiveRsvpRow[],
  };
}

function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function archiveCsv(data: Awaited<ReturnType<typeof getArchiveData>>) {
  const headers = ["団体コード", "年度", "予定ID", "開始日時", "終了日時", "予定", "場所", "詳細", "メンバー", "出欠", "回答日時"];
  const statusLabels: Record<string, string> = {
    attending: "参加",
    declined: "不参加",
    maybe: "未定",
  };
  const rsvpsByEvent = new Map<string, ArchiveRsvpRow[]>();

  for (const rsvp of data.rsvps) {
    rsvpsByEvent.set(rsvp.event_id, [...(rsvpsByEvent.get(rsvp.event_id) ?? []), rsvp]);
  }

  const rows = data.events.flatMap((event) => {
    const eventRsvps = rsvpsByEvent.get(event.id) ?? [];
    const base = [
      data.organization.code,
      data.archive.year,
      event.id,
      event.start_at,
      event.end_at,
      event.title,
      event.location,
      event.description,
    ];

    if (eventRsvps.length === 0) {
      return [[...base, "", "", ""]];
    }

    return eventRsvps.map((rsvp) => [
      ...base,
      rsvp.member_name,
      statusLabels[rsvp.status] ?? rsvp.status,
      rsvp.updated_at,
    ]);
  });

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ArchiveRequestBody;
  const year = parseYear(body.year);
  if (!year) {
    return NextResponse.json({ error: "A four-digit year is required." }, { status: 400 });
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

  if (body.action === "delete") {
    if (body.confirmation !== `${organization.code}:${year}`) {
      return NextResponse.json({ error: "Archive deletion confirmation is required." }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM events
      WHERE organization_id = ${organization.id}
        AND end_at < NOW()
        AND EXTRACT(YEAR FROM start_at AT TIME ZONE 'Asia/Tokyo') = ${year}
      RETURNING id
    `;

    return NextResponse.json({ ok: true, deletedEvents: deleted.rows.length });
  }

  if (body.action !== "download") {
    return NextResponse.json({ error: "Invalid archive action." }, { status: 400 });
  }

  const data = await getArchiveData(organization, year);
  const filename = `${organization.code}-archive-${year}`;

  if (body.format === "csv") {
    return new Response(archiveCsv(data), {
      headers: {
        "content-disposition": `attachment; filename="${filename}.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="${filename}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
