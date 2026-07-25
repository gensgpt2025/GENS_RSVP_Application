import assert from "node:assert/strict";
import test from "node:test";
import nextConfig, { securityHeaders } from "../next.config.ts";

function headersByName() {
  return new Map(securityHeaders.map((header) => [header.key.toLowerCase(), header.value]));
}

test("security headers apply to every route", async () => {
  const rules = await nextConfig.headers();

  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/(.*)");
  assert.equal(rules[0].headers, securityHeaders);
});

test("baseline browser security headers are configured", () => {
  const headers = headersByName();

  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("permissions-policy"), /camera=\(\)/);
  assert.match(headers.get("permissions-policy"), /microphone=\(\)/);
  assert.match(headers.get("permissions-policy"), /geolocation=\(\)/);
});

test("content security policy restricts data and embedding", () => {
  const policy = headersByName().get("content-security-policy");

  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /connect-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
  assert.match(policy, /form-action 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /default-src \*/);
});
