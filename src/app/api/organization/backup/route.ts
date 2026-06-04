import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await requireUser();

  const [organization, members, events, rsvps] = await Promise.all([
    sql`SELECT id, name, code, active, created_at FROM organizations WHERE id = ${user.organization_id}`,
    sql`SELECT id, name, email, role, active, created_at FROM members WHERE organization_id = ${user.organization_id} ORDER BY created_at ASC`,
    sql`SELECT id, sheet_id, title, description, location, start_at, end_at, created_by, created_at FROM events WHERE organization_id = ${user.organization_id} ORDER BY start_at ASC`,
    sql`
      SELECT rsvps.event_id, rsvps.user_id, rsvps.status, rsvps.note, rsvps.updated_at
      FROM rsvps
      INNER JOIN events ON events.id = rsvps.event_id
      WHERE events.organization_id = ${user.organization_id}
      ORDER BY rsvps.updated_at ASC
    `,
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    organization: organization.rows[0],
    members: members.rows,
    events: events.rows,
    rsvps: rsvps.rows,
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as { backup?: { members?: any[]; events?: any[]; rsvps?: any[] } };

  const backup = body.backup ?? {};
  for (const member of backup.members ?? []) {
    await sql`
      INSERT INTO members (id, organization_id, name, email, password_hash, role, active, created_at)
      VALUES (${member.id}, ${user.organization_id}, ${member.name}, ${member.email}, 'restored-no-password', ${member.role}, ${member.active ?? true}, ${member.created_at ?? new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          role = EXCLUDED.role,
          active = EXCLUDED.active
    `;
  }

  for (const event of backup.events ?? []) {
    await sql`
      INSERT INTO events (id, organization_id, sheet_id, title, description, location, start_at, end_at, created_by, created_at)
      VALUES (${event.id}, ${user.organization_id}, ${event.sheet_id ?? null}, ${event.title}, ${event.description ?? null}, ${event.location ?? null}, ${event.start_at}, ${event.end_at}, ${event.created_by ?? null}, ${event.created_at ?? new Date().toISOString()})
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
      VALUES (${rsvp.event_id}, ${rsvp.user_id}, ${rsvp.status}, ${rsvp.note ?? null}, ${rsvp.updated_at ?? new Date().toISOString()})
      ON CONFLICT (event_id, user_id) DO UPDATE
      SET status = EXCLUDED.status,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at
    `;
  }

  return NextResponse.json({ ok: true });
}
