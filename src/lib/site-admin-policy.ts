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
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return `認証を3回失敗したためロックされています。約${minutes}分後にもう一度お試しください。`;
  }

  if (result.status === "invalid") {
    return `サイト管理者の認証に失敗しました。あと${result.remainingAttempts}回失敗すると15分間ロックされます。`;
  }

  return "";
}
