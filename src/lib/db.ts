import {
  neon,
  type NeonQueryFunctionInTransaction,
  type NeonQueryInTransaction,
} from "@neondatabase/serverless";
import { hashPassword } from "@/lib/security";

let schemaReady: Promise<void> | null = null;
let dbClient: ReturnType<typeof neon<false, true>> | null = null;
type TransactionBuilder = (
  transactionSql: NeonQueryFunctionInTransaction<false, true>,
) => NeonQueryInTransaction[];

function getSql() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required. Connect a Neon Postgres database on Vercel.");
  }

  dbClient ??= neon(connectionString, { fullResults: true });
  return dbClient;
}

export function sql(strings: TemplateStringsArray, ...params: unknown[]) {
  return getSql()(strings, ...params);
}

export function sqlTransaction(queries: TransactionBuilder) {
  return getSql().transaction(queries, { isolationLevel: "Serializable" });
}

export async function ensureSchema() {
  schemaReady ??= createSchema();
  await schemaReady;
}

async function createSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      admin_passcode_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const defaultOrgId = await ensureDefaultOrganization();

  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE`;
  await sql`UPDATE members SET organization_id = ${defaultOrgId} WHERE organization_id IS NULL`;
  await sql`ALTER TABLE members ALTER COLUMN organization_id SET NOT NULL`;
  await sql`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_key`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_organization_email ON members(organization_id, email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS site_admin_login_attempts (
      identifier_hash TEXT PRIMARY KEY,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      sheet_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE`;
  await sql`UPDATE events SET organization_id = ${defaultOrgId} WHERE organization_id IS NULL`;
  await sql`ALTER TABLE events ALTER COLUMN organization_id SET NOT NULL`;
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS sheet_id TEXT`;
  await sql`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_sheet_id_key`;
  await sql`DROP INDEX IF EXISTS idx_events_sheet_id`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_organization_sheet_id ON events(organization_id, sheet_id) WHERE sheet_id IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS rsvps (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, user_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_organization_start_at ON events(organization_id, start_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_members_organization_id ON members(organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_site_admin_login_attempts_updated_at ON site_admin_login_attempts(updated_at)`;

  await seedDefaultMember(defaultOrgId);
}

async function ensureDefaultOrganization() {
  const code = (process.env.ORGANIZATION_CODE ?? "GENS").trim().toUpperCase();
  const name = process.env.ORGANIZATION_NAME?.trim() || "GENS";
  const passcode = process.env.SITE_ADMIN_PASSWORD || crypto.randomUUID();

  const existing = await sql`SELECT id FROM organizations WHERE code = ${code} LIMIT 1`;
  if (existing.rows[0]) return String(existing.rows[0].id);

  const firstOrganization = await sql`
    SELECT id
    FROM organizations
    ORDER BY created_at ASC
    LIMIT 1
  `;
  if (firstOrganization.rows[0]) return String(firstOrganization.rows[0].id);

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO organizations (id, name, code, admin_passcode_hash)
    VALUES (${id}, ${name}, ${code}, ${hashPassword(passcode)})
  `;
  return id;
}

async function seedDefaultMember(organizationId: string) {
  const name = "メンバー";
  const email = `member-${organizationId}@members.local`;

  await sql`
    INSERT INTO members (id, organization_id, name, email, password_hash, role)
    VALUES (${crypto.randomUUID()}, ${organizationId}, ${name}, ${email}, ${hashPassword(crypto.randomUUID())}, 'member')
    ON CONFLICT (organization_id, email) DO NOTHING
  `;
}
