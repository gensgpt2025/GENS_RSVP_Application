import { timingSafeEqual } from "node:crypto";

export const AUTOMATIC_BACKUP_PREFIX = "automatic-backups/";
export const AUTOMATIC_BACKUP_RETENTION_DAYS = 35;

function japanDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
}

export function automaticBackupDate(date: Date) {
  const parts = japanDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function automaticBackupPath(organizationCode: string, organizationId: string, date: Date) {
  const code = organizationCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
  const id = organizationId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${AUTOMATIC_BACKUP_PREFIX}${automaticBackupDate(date)}/${code}-${id}.json`;
}

export function isExpiredAutomaticBackup(uploadedAt: Date, now: Date) {
  const retentionMilliseconds = AUTOMATIC_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1_000;
  return uploadedAt.getTime() < now.getTime() - retentionMilliseconds;
}

export function isCronRequestAuthorized(authorizationHeader: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !authorizationHeader) return false;

  const supplied = Buffer.from(authorizationHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
