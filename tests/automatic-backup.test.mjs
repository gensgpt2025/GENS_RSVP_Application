import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  automaticBackupDate,
  automaticBackupPath,
  isCronRequestAuthorized,
  isExpiredAutomaticBackup,
} from "../src/lib/automatic-backup.ts";

test("schedules backups for the 5th, 15th, and 25th in Japan", () => {
  const vercelConfig = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const backupCron = vercelConfig.crons.find(
    (cron) => cron.path === "/api/cron/automatic-backup",
  );

  assert.equal(backupCron?.schedule, "0 18 4,14,24 * *");
  assert.equal(
    automaticBackupDate(new Date("2026-07-24T18:00:00.000Z")),
    "2026-07-25",
  );
});

test("uses the Japan calendar date for backup paths", () => {
  const now = new Date("2026-07-25T18:30:00.000Z");

  assert.equal(automaticBackupDate(now), "2026-07-26");
  assert.equal(
    automaticBackupPath("team-01", "organization-1", now),
    "automatic-backups/2026-07-26/TEAM-01-organization-1.json",
  );
});

test("authorizes only an exact bearer secret of sufficient length", () => {
  const secret = "a-secure-cron-secret-value";

  assert.equal(isCronRequestAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isCronRequestAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(isCronRequestAuthorized("Bearer short", "short"), false);
  assert.equal(isCronRequestAuthorized(null, secret), false);
});

test("expires backups older than thirty-five days", () => {
  const now = new Date("2026-07-25T00:00:00.000Z");

  assert.equal(isExpiredAutomaticBackup(new Date("2026-06-19T23:59:59.999Z"), now), true);
  assert.equal(isExpiredAutomaticBackup(new Date("2026-06-20T00:00:00.000Z"), now), false);
});
