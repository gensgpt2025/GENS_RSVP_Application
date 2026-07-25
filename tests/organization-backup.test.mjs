import assert from "node:assert/strict";
import test from "node:test";
import {
  BackupValidationError,
  validateOrganizationBackup,
} from "../src/lib/organization-backup.ts";

function validBackup() {
  return {
    schemaVersion: 1,
    organization: {
      id: "organization-1",
      name: "Test Team",
      code: "TEAM1",
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    members: [
      {
        id: "member-1",
        name: "Member One",
        email: "member-1@members.local",
        role: "member",
        active: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        sheet_id: null,
        title: "Practice",
        description: null,
        location: "Gym",
        start_at: "2026-07-01T00:00:00.000Z",
        end_at: "2026-07-01T02:00:00.000Z",
        created_by: "member-1",
        created_at: "2026-06-01T00:00:00.000Z",
      },
    ],
    rsvps: [
      {
        event_id: "event-1",
        user_id: "member-1",
        status: "attending",
        note: null,
        updated_at: "2026-06-20T00:00:00.000Z",
      },
    ],
  };
}

test("accepts a valid backup for the selected organization", () => {
  const result = validateOrganizationBackup(validBackup(), "team1");

  assert.equal(result.organizationCode, "TEAM1");
  assert.equal(result.members.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.rsvps.length, 1);
});

test("rejects a backup for another organization", () => {
  assert.throws(
    () => validateOrganizationBackup(validBackup(), "TEAM2"),
    BackupValidationError,
  );
});

test("rejects duplicate member IDs", () => {
  const backup = validBackup();
  backup.members.push({ ...backup.members[0] });

  assert.throws(
    () => validateOrganizationBackup(backup, "TEAM1"),
    BackupValidationError,
  );
});

test("rejects an event creator outside the backup members", () => {
  const backup = validBackup();
  backup.events[0].created_by = "member-from-another-team";

  assert.throws(
    () => validateOrganizationBackup(backup, "TEAM1"),
    BackupValidationError,
  );
});

test("rejects an RSVP with a missing event reference", () => {
  const backup = validBackup();
  backup.rsvps[0].event_id = "missing-event";

  assert.throws(
    () => validateOrganizationBackup(backup, "TEAM1"),
    BackupValidationError,
  );
});

test("rejects an unsupported RSVP status", () => {
  const backup = validBackup();
  backup.rsvps[0].status = "unknown";

  assert.throws(
    () => validateOrganizationBackup(backup, "TEAM1"),
    BackupValidationError,
  );
});

test("accepts an event-only yearly archive", () => {
  const backup = validBackup();
  backup.members = [];
  backup.events[0].created_by = null;
  backup.rsvps = [];

  const result = validateOrganizationBackup(backup, "TEAM1");

  assert.equal(result.members.length, 0);
  assert.equal(result.events.length, 1);
});
