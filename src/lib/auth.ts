import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSchema, sql } from "@/lib/db";
import { hashToken, verifyPassword } from "@/lib/security";
import type { Member, SessionUser } from "@/lib/types";

const SESSION_COOKIE = "gens_session";
const SESSION_DAYS = 14;

async function createSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt.toISOString()})
  `;

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function loginAsMember(organizationCode: string, memberId: string) {
  await ensureSchema();
  const code = organizationCode.trim().toUpperCase();

  const { rows } = await sql`
    SELECT members.id
    FROM members
    INNER JOIN organizations ON organizations.id = members.organization_id
    WHERE members.id = ${memberId}
      AND organizations.code = ${code}
      AND organizations.active = TRUE
      AND members.active = TRUE
    LIMIT 1
  `;

  const member = rows[0] as Pick<Member, "id"> | undefined;
  if (!member) {
    return { ok: false, message: "団体コードとメンバーを確認してください。" };
  }

  await createSession(member.id);
  return { ok: true, message: "入室しました。" };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureSchema();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  await ensureSchema();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { rows } = await sql`
    SELECT
      members.id,
      members.organization_id,
      members.name,
      members.email,
      members.role,
      members.active,
      members.created_at,
      organizations.name AS organization_name,
      organizations.code AS organization_code
    FROM sessions
    INNER JOIN members ON members.id = sessions.user_id
    INNER JOIN organizations ON organizations.id = members.organization_id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > NOW()
      AND members.active = TRUE
      AND organizations.active = TRUE
    LIMIT 1
  `;

  return (rows[0] as SessionUser | undefined) ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function verifyAdminPasscode(passcode: string) {
  const user = await requireAdmin();
  const { rows } = await sql`
    SELECT admin_passcode_hash
    FROM organizations
    WHERE id = ${user.organization_id}
      AND active = TRUE
    LIMIT 1
  `;

  const organization = rows[0] as { admin_passcode_hash: string } | undefined;
  if (!organization || !verifyPassword(passcode, organization.admin_passcode_hash)) {
    return null;
  }

  return user;
}
