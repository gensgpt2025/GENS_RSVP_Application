export const SITE_ADMIN_MAX_FAILED_ATTEMPTS = 3;
export const SITE_ADMIN_LOCK_MINUTES = 15;

export type SiteAdminAuthResult = {
  ok: boolean;
  status: "authenticated" | "invalid" | "locked";
  remainingAttempts: number;
  retryAfterSeconds: number;
};

export function getSiteAdminClientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function siteAdminAuthMessage(result: SiteAdminAuthResult) {
  if (result.status === "locked") {
    return "サイト管理者認証は一時的にロックされています。しばらくしてからもう一度お試しください。";
  }

  if (result.status === "invalid") {
    return "サイト管理者の認証に失敗しました。入力内容を確認してください。";
  }

  return "";
}
