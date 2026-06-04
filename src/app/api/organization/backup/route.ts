import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { verifySiteAdmin } from "@/lib/site-admin";

type BackupPayload = {
  members?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  rsvps?: Record<string, unknown>[];
};

type BackupRequestBody = {
  action?: "download" | "restore";
  organizationCode?: string;
  siteAdminUsername?: string;
  siteAdminPassword?: string;
  backup?: BackupPayload;
};

type OrganizationRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
};

async function getOrganizationForSiteAdmin(organizationCode: string, siteAdminUsername: string, siteAdminPassword: string) {
  await ensureSchema();
  const code = organizationCode.trim().toUpperCase();
  if (!code || !verifySiteAdmin(siteAdminUsername, siteAdminPassword)) return null;

  const { rows } = await sql`
    SELECT id, name, code, active, created_at
    FROM organizations
    WHERE code = ${code}
    LIMIT 1
  `;
  return (rows[0] as OrganizationRow | undefined) ?? null;
}

function value(row: Record<string, unknown>, key: string, fallback: unknown = null) {
  return row[key] ?? fallback;
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

export async function POST(request: Request) {
  const body = (await request.json()) as BackupRequestBody;
  const organization = await getOrganizationForSiteAdmin(
    body.organizationCode ?? "",
    body.siteAdminUsername ?? "",
    body.siteAdminPassword ?? "",
  );

  if (!organization) {
    return NextResponse.json({ error: "Invalid organization code or site admin credentials." }, { status: 403 });
  }

  if (body.action === "download") {
    return buildBackupResponse(organization);
  }

  if (!body.backup) {
    return NextResponse.json({ error: "Backup file is required." }, { status: 400 });
  }

  const backup = body.backup ?? {};
  for (const member of backup.members ?? []) {
    await sql`
      INSERT INTO members (id, organization_id, name, email, password_hash, role, active, created_at)
      VALUES (${value(member, "id")}, ${organization.id}, ${value(member, "name")}, ${value(member, "email")}, 'restored-no-password', ${value(member, "role", "member")}, ${value(member, "active", true)}, ${value(member, "created_at", new Date().toISOString())})
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          active = EXCLUDED.active
    `;
  }

  for (const event of backup.events ?? []) {
    await sql`
      INSERT INTO events (id, organization_id, sheet_id, title, description, location, start_at, end_at, created_by, created_at)
      VALUES (${value(event, "id")}, ${organization.id}, ${value(event, "sheet_id")}, ${value(event, "title")}, ${value(event, "description")}, ${value(event, "location")}, ${value(event, "start_at")}, ${value(event, "end_at")}, ${value(event, "created_by")}, ${value(event, "created_at", new Date().toISOString())})
      ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at
    `;
  }

  for (const rsvp of backup.rsvps ?? []) {
    await sql`
      INSERT INTO rsvps (event_id, user_id, status, note, updated_at)
      VALUES (${value(rsvp, "event_id")}, ${value(rsvp, "user_id")}, ${value(rsvp, "status")}, ${value(rsvp, "note")}, ${value(rsvp, "updated_at", new Date().toISOString())})
      ON CONFLICT (event_id, user_id) DO UPDATE
      SET status = EXCLUDED.status,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at
    `;
  }

  return NextResponse.json({ ok: true });
}
