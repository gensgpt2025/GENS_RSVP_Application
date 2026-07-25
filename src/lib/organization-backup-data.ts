import { ensureSchema, sql } from "@/lib/db";

export type OrganizationBackupSource = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
};

type OrganizationScopedRow = {
  organization_id: string;
  [key: string]: unknown;
};

export type OrganizationBackupDocument = {
  schemaVersion: 1;
  backupType: "organization";
  exportedAt: string;
  organization: OrganizationBackupSource;
  members: Omit<OrganizationScopedRow, "organization_id">[];
  events: Omit<OrganizationScopedRow, "organization_id">[];
  rsvps: Omit<OrganizationScopedRow, "organization_id">[];
};

function withoutOrganizationId(row: OrganizationScopedRow) {
  const { organization_id: _, ...data } = row;
  return data;
}

function assembleOrganizationBackup(
  organization: OrganizationBackupSource,
  members: OrganizationScopedRow[],
  events: OrganizationScopedRow[],
  rsvps: OrganizationScopedRow[],
  exportedAt: string,
): OrganizationBackupDocument {
  return {
    schemaVersion: 1,
    backupType: "organization",
    exportedAt,
    organization,
    members: members.filter((row) => row.organization_id === organization.id).map(withoutOrganizationId),
    events: events.filter((row) => row.organization_id === organization.id).map(withoutOrganizationId),
    rsvps: rsvps.filter((row) => row.organization_id === organization.id).map(withoutOrganizationId),
  };
}

export async function buildOrganizationBackup(
  organization: OrganizationBackupSource,
): Promise<OrganizationBackupDocument> {
  const [members, events, rsvps] = await Promise.all([
    sql`
      SELECT organization_id, id, name, email, role, active, created_at
      FROM members
      WHERE organization_id = ${organization.id}
      ORDER BY created_at ASC
    `,
    sql`
      SELECT organization_id, id, sheet_id, title, description, location, start_at, end_at, created_by, created_at
      FROM events
      WHERE organization_id = ${organization.id}
      ORDER BY start_at ASC
    `,
    sql`
      SELECT events.organization_id, rsvps.event_id, rsvps.user_id, rsvps.status, rsvps.note, rsvps.updated_at
      FROM rsvps
      INNER JOIN events ON events.id = rsvps.event_id
      WHERE events.organization_id = ${organization.id}
      ORDER BY rsvps.updated_at ASC
    `,
  ]);

  return assembleOrganizationBackup(
    organization,
    members.rows as OrganizationScopedRow[],
    events.rows as OrganizationScopedRow[],
    rsvps.rows as OrganizationScopedRow[],
    new Date().toISOString(),
  );
}

export async function buildAllOrganizationBackups(): Promise<OrganizationBackupDocument[]> {
  await ensureSchema();

  const [organizations, members, events, rsvps] = await Promise.all([
    sql`
      SELECT id, name, code, active, created_at
      FROM organizations
      ORDER BY created_at ASC
    `,
    sql`
      SELECT organization_id, id, name, email, role, active, created_at
      FROM members
      ORDER BY organization_id, created_at ASC
    `,
    sql`
      SELECT organization_id, id, sheet_id, title, description, location, start_at, end_at, created_by, created_at
      FROM events
      ORDER BY organization_id, start_at ASC
    `,
    sql`
      SELECT events.organization_id, rsvps.event_id, rsvps.user_id, rsvps.status, rsvps.note, rsvps.updated_at
      FROM rsvps
      INNER JOIN events ON events.id = rsvps.event_id
      ORDER BY events.organization_id, rsvps.updated_at ASC
    `,
  ]);

  const exportedAt = new Date().toISOString();
  const memberRows = members.rows as OrganizationScopedRow[];
  const eventRows = events.rows as OrganizationScopedRow[];
  const rsvpRows = rsvps.rows as OrganizationScopedRow[];

  return (organizations.rows as OrganizationBackupSource[]).map((organization) =>
    assembleOrganizationBackup(organization, memberRows, eventRows, rsvpRows, exportedAt),
  );
}
