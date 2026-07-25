import type { Role, RsvpStatus } from "@/lib/types";

const MAX_MEMBERS = 5_000;
const MAX_EVENTS = 20_000;
const MAX_RSVPS = 100_000;

type JsonRecord = Record<string, unknown>;

export type RestoredMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type RestoredEvent = {
  id: string;
  sheet_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  created_by: string | null;
  created_at: string;
};

export type RestoredRsvp = {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  note: string | null;
  updated_at: string;
};

export type ValidatedOrganizationBackup = {
  organizationId: string;
  organizationCode: string;
  members: RestoredMember[];
  events: RestoredEvent[];
  rsvps: RestoredRsvp[];
};

export class BackupValidationError extends Error {}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BackupValidationError(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string, maximum: number) {
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`${label} must be an array.`);
  }
  if (value.length > maximum) {
    throw new BackupValidationError(`${label} exceeds the maximum item count.`);
  }
  return value;
}

function stringValue(row: JsonRecord, key: string, maximum: number) {
  const value = row[key];
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new BackupValidationError(`${key} is invalid.`);
  }
  return value.trim();
}

function nullableString(row: JsonRecord, key: string, maximum: number) {
  const value = row[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maximum) {
    throw new BackupValidationError(`${key} is invalid.`);
  }
  return value;
}

function booleanValue(row: JsonRecord, key: string, fallback: boolean) {
  const value = row[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new BackupValidationError(`${key} is invalid.`);
  }
  return value;
}

function dateValue(row: JsonRecord, key: string) {
  const value = stringValue(row, key, 64);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BackupValidationError(`${key} is invalid.`);
  }
  return date.toISOString();
}

function unique(values: string[], label: string, normalize = (value: string) => value) {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalize(value);
    if (seen.has(normalized)) {
      throw new BackupValidationError(`${label} contains duplicate values.`);
    }
    seen.add(normalized);
  }
}

export function validateOrganizationBackup(
  input: unknown,
  expectedOrganizationCode: string,
  expectedOrganizationId?: string,
): ValidatedOrganizationBackup {
  const backup = record(input, "backup");
  if (backup.schemaVersion !== undefined && backup.schemaVersion !== 1) {
    throw new BackupValidationError("Unsupported backup schema version.");
  }

  const organization = record(backup.organization, "organization");
  const organizationId = stringValue(organization, "id", 128);
  const organizationCode = stringValue(organization, "code", 24).toUpperCase();
  const codeMatches = organizationCode === expectedOrganizationCode.trim().toUpperCase();
  const idMatches = Boolean(expectedOrganizationId) && organizationId === expectedOrganizationId;
  if (!codeMatches && !idMatches) {
    throw new BackupValidationError("Backup organization does not match the restore target.");
  }

  const memberRows = array(backup.members, "members", MAX_MEMBERS);
  const members = memberRows.map((item) => {
    const row = record(item, "member");
    const role = stringValue(row, "role", 16);
    if (role !== "admin" && role !== "member") {
      throw new BackupValidationError("Member role is invalid.");
    }

    return {
      id: stringValue(row, "id", 128),
      name: stringValue(row, "name", 100),
      email: stringValue(row, "email", 254),
      role: role as Role,
      active: booleanValue(row, "active", true),
      created_at: dateValue(row, "created_at"),
    };
  });

  unique(members.map((member) => member.id), "members.id");
  unique(
    members.map((member) => member.email),
    "members.email",
    (email) => email.toLowerCase(),
  );
  const memberIds = new Set(members.map((member) => member.id));

  const events = array(backup.events, "events", MAX_EVENTS).map((item) => {
    const row = record(item, "event");
    const startAt = dateValue(row, "start_at");
    const endAt = dateValue(row, "end_at");
    if (new Date(endAt) <= new Date(startAt)) {
      throw new BackupValidationError("Event end_at must be after start_at.");
    }

    const createdBy = nullableString(row, "created_by", 128);
    if (createdBy && !memberIds.has(createdBy)) {
      throw new BackupValidationError("Event created_by must reference a member in the backup.");
    }

    return {
      id: stringValue(row, "id", 128),
      sheet_id: nullableString(row, "sheet_id", 255),
      title: stringValue(row, "title", 200),
      description: nullableString(row, "description", 5_000),
      location: nullableString(row, "location", 500),
      start_at: startAt,
      end_at: endAt,
      created_by: createdBy,
      created_at: dateValue(row, "created_at"),
    };
  });

  unique(events.map((event) => event.id), "events.id");
  unique(
    events.flatMap((event) => (event.sheet_id ? [event.sheet_id] : [])),
    "events.sheet_id",
  );
  const eventIds = new Set(events.map((event) => event.id));

  const rsvps = array(backup.rsvps, "rsvps", MAX_RSVPS).map((item) => {
    const row = record(item, "rsvp");
    const eventId = stringValue(row, "event_id", 128);
    const userId = stringValue(row, "user_id", 128);
    const status = stringValue(row, "status", 16);

    if (!eventIds.has(eventId) || !memberIds.has(userId)) {
      throw new BackupValidationError("RSVP references must exist in the backup.");
    }
    if (status !== "attending" && status !== "declined" && status !== "maybe") {
      throw new BackupValidationError("RSVP status is invalid.");
    }

    return {
      event_id: eventId,
      user_id: userId,
      status: status as RsvpStatus,
      note: nullableString(row, "note", 2_000),
      updated_at: dateValue(row, "updated_at"),
    };
  });

  unique(
    rsvps.map((rsvp) => `${rsvp.event_id}\u0000${rsvp.user_id}`),
    "rsvps",
  );

  return { organizationId, organizationCode, members, events, rsvps };
}
