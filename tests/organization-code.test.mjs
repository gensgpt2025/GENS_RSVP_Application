import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeOrganizationCode,
  validateOrganizationCodeChange,
} from "../src/lib/organization-code.ts";

test("normalizes an organization code", () => {
  assert.equal(normalizeOrganizationCode(" team_01 "), "TEAM_01");
});

test("accepts a valid organization code change", () => {
  assert.equal(validateOrganizationCodeChange("OLD-CODE", "NEW_CODE", "new_code"), null);
});

test("rejects an invalid new organization code", () => {
  assert.match(
    validateOrganizationCodeChange("OLD-CODE", "新コード", "新コード") ?? "",
    /3〜24文字/,
  );
});

test("rejects a mismatched confirmation", () => {
  assert.match(
    validateOrganizationCodeChange("OLD-CODE", "NEW-CODE", "OTHER-CODE") ?? "",
    /一致しません/,
  );
});

test("rejects an unchanged organization code", () => {
  assert.match(
    validateOrganizationCodeChange("TEAM-01", "team-01", "TEAM-01") ?? "",
    /異なる団体コード/,
  );
});
