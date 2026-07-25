import assert from "node:assert/strict";
import test from "node:test";
import {
  getSiteAdminClientAddress,
  SITE_ADMIN_LOCK_MINUTES,
  SITE_ADMIN_MAX_FAILED_ATTEMPTS,
  siteAdminAuthMessage,
} from "../src/lib/site-admin-policy.ts";

test("site admin policy uses three failures and a fifteen minute lock", () => {
  assert.equal(SITE_ADMIN_MAX_FAILED_ATTEMPTS, 3);
  assert.equal(SITE_ADMIN_LOCK_MINUTES, 15);
});

test("client address uses the first forwarded address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 198.51.100.20",
    "x-real-ip": "192.0.2.30",
  });

  assert.equal(getSiteAdminClientAddress(headers), "203.0.113.10");
});

test("invalid authentication shows the remaining attempt count", () => {
  const message = siteAdminAuthMessage({
    ok: false,
    status: "invalid",
    remainingAttempts: 2,
    retryAfterSeconds: 0,
  });

  assert.match(message, /あと2回/);
  assert.match(message, /15分間ロック/);
});

test("locked authentication rounds the remaining time up to minutes", () => {
  const message = siteAdminAuthMessage({
    ok: false,
    status: "locked",
    remainingAttempts: 0,
    retryAfterSeconds: 61,
  });

  assert.match(message, /3回失敗/);
  assert.match(message, /約2分後/);
});
