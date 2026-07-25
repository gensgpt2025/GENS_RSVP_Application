import { timingSafeEqual } from "node:crypto";
import { ensureSchema, sql } from "@/lib/db";
import { hashToken } from "@/lib/security";
import {
  SITE_ADMIN_LOCK_MINUTES,
  SITE_ADMIN_MAX_FAILED_ATTEMPTS,
  type SiteAdminAuthResult,
} from "@/lib/site-admin-policy";

export {
  getSiteAdminClientAddress,
  siteAdminAuthMessage,
  type SiteAdminAuthResult,
} from "@/lib/site-admin-policy";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function expectedSiteAdminUsername() {
  return (process.env.SITE_ADMIN_USERNAME ?? "sugaya").trim().toLowerCase();
}

function verifySiteAdmin(username: string, password: string) {
  const expectedUsername = expectedSiteAdminUsername();
  const expectedPassword = process.env.SITE_ADMIN_PASSWORD;

  if (!expectedPassword) return false;
  return safeEqual(username.trim().toLowerCase(), expectedUsername) && safeEqual(password, expectedPassword);
}

export async function authenticateSiteAdmin(
  username: string,
  password: string,
  clientAddress: string,
): Promise<SiteAdminAuthResult> {
  await ensureSchema();

  const identifierHash = hashToken(`site-admin:${expectedSiteAdminUsername()}:${clientAddress}`);
  const credentialsValid = verifySiteAdmin(username, password);
  const result = await sql`
    INSERT INTO site_admin_login_attempts (
      identifier_hash,
      failed_attempts,
      locked_until,
      updated_at
    )
    VALUES (
      ${identifierHash},
      CASE WHEN ${credentialsValid} THEN 0 ELSE 1 END,
      NULL,
      NOW()
    )
    ON CONFLICT (identifier_hash) DO UPDATE
    SET
      failed_attempts = CASE
        WHEN site_admin_login_attempts.locked_until > NOW()
          THEN site_admin_login_attempts.failed_attempts
        WHEN ${credentialsValid}
          THEN 0
        WHEN site_admin_login_attempts.locked_until IS NOT NULL
          THEN 1
        ELSE site_admin_login_attempts.failed_attempts + 1
      END,
      locked_until = CASE
        WHEN site_admin_login_attempts.locked_until > NOW()
          THEN site_admin_login_attempts.locked_until
        WHEN ${credentialsValid}
          THEN NULL
        WHEN site_admin_login_attempts.locked_until IS NOT NULL
          THEN NULL
        WHEN site_admin_login_attempts.failed_attempts + 1 >= ${SITE_ADMIN_MAX_FAILED_ATTEMPTS}
          THEN NOW() + (${SITE_ADMIN_LOCK_MINUTES} * INTERVAL '1 minute')
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING
      failed_attempts,
      locked_until,
      GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM (locked_until - NOW())))
      )::INTEGER AS retry_after_seconds
  `;

  const row = result.rows[0] as {
    failed_attempts: number;
    locked_until: string | null;
    retry_after_seconds: number;
  };
  const retryAfterSeconds = Number(row.retry_after_seconds ?? 0);

  if (row.locked_until && retryAfterSeconds > 0) {
    return {
      ok: false,
      status: "locked",
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  if (!credentialsValid) {
    return {
      ok: false,
      status: "invalid",
      remainingAttempts: Math.max(0, SITE_ADMIN_MAX_FAILED_ATTEMPTS - Number(row.failed_attempts)),
      retryAfterSeconds: 0,
    };
  }

  return {
    ok: true,
    status: "authenticated",
    remainingAttempts: SITE_ADMIN_MAX_FAILED_ATTEMPTS,
    retryAfterSeconds: 0,
  };
}
