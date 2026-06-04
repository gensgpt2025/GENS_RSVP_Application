"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginAsMember, logout, requireUser, verifyAdminPasscode } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/security";
import type { RsvpStatus } from "@/lib/types";

export type MemberFormState = {
  message: string;
  needsConfirmation: boolean;
  pendingName: string;
};

export type OrganizationFormState = {
  message: string;
};

function readString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function japanDateTimeRangeToIso(value: string) {
  const normalized = value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[：]/g, ":")
    .replace(/[ー－―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, startHour, startMinute, endHour, endMinute] = match.map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, startHour - 9, startMinute));
  const end = new Date(Date.UTC(year, month - 1, day, endHour - 9, endMinute));
  if (end <= start) return null;

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function dateTimeLocalToIso(startValue: string, endValue: string) {
  const startMatch = startValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  const endMatch = endValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!startMatch || !endMatch) return null;

  const [, startYear, startMonth, startDay, startHour, startMinute] = startMatch.map(Number);
  const [, endYear, endMonth, endDay, endHour, endMinute] = endMatch.map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHour - 9, startMinute));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, endHour - 9, endMinute));
  if (end <= start) return null;

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function eventDateAndTimesToIso(dateValue: string, startTimeValue: string, endTimeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const startMatch = startTimeValue.match(/^(\d{2}):(\d{2})$/);
  const endMatch = endTimeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !startMatch || !endMatch) return null;

  const [, year, month, day] = dateMatch.map(Number);
  const [, startHour, startMinute] = startMatch.map(Number);
  const [, endHour, endMinute] = endMatch.map(Number);
  if (startMinute % 10 !== 0 || endMinute % 10 !== 0) return null;

  const start = new Date(Date.UTC(year, month - 1, day, startHour - 9, startMinute));
  const end = new Date(Date.UTC(year, month - 1, day, endHour - 9, endMinute));
  if (end <= start) return null;

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function eventDateTimeRangeToIso(formData: FormData) {
  const eventDate = readString(formData, "event_date");
  const startTime = readString(formData, "start_time");
  const endTime = readString(formData, "end_time");
  if (eventDate || startTime || endTime) return eventDateAndTimesToIso(eventDate, startTime, endTime);

  const startDatetime = readString(formData, "start_datetime");
  const endDatetime = readString(formData, "end_datetime");
  if (startDatetime || endDatetime) return dateTimeLocalToIso(startDatetime, endDatetime);

  return japanDateTimeRangeToIso(readString(formData, "datetime_range"));
}

function eventTitle(category: string, opponent: string) {
  if ((category === "練習試合" || category === "県リーグ") && opponent) {
    return `${category} vs ${opponent}`;
  }

  return category;
}

function memberLoginEmail(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `${slug || "member"}-${crypto.randomUUID()}@members.local`;
}

export async function loginAction(_: unknown, formData: FormData) {
  const result = await loginAsMember(readString(formData, "organization_code"), readString(formData, "member_id"));
  if (result.ok) redirect("/");
  return result;
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

export async function createOrganizationAction(_: OrganizationFormState, formData: FormData): Promise<OrganizationFormState> {
  await ensureSchema();

  const name = readString(formData, "organization_name");
  const code = readString(formData, "organization_code").toUpperCase();
  const adminName = readString(formData, "admin_name") || "管理者";
  const adminPasscode = readString(formData, "admin_passcode");

  if (!name || !code || !adminPasscode) {
    return { message: "団体名、団体コード、管理者パスコードを入力してください。" };
  }

  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    return { message: "団体コードは3〜24文字の英数字、ハイフン、アンダーバーで設定してください。" };
  }

  const organizationId = crypto.randomUUID();
  try {
    await sql`
      INSERT INTO organizations (id, name, code, admin_passcode_hash)
      VALUES (${organizationId}, ${name}, ${code}, ${hashPassword(adminPasscode)})
    `;

    await sql`
      INSERT INTO members (id, organization_id, name, email, password_hash, role)
      VALUES (${crypto.randomUUID()}, ${organizationId}, ${adminName}, ${memberLoginEmail(adminName)}, ${hashPassword(crypto.randomUUID())}, 'admin')
    `;
  } catch {
    return { message: "この団体コードはすでに使われています。" };
  }

  return { message: `団体「${name}」を作成しました。団体コード「${code}」でログインできます。` };
}

export async function createMemberAction(_: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requireUser();

  const name = readString(formData, "name");
  const confirmed = readString(formData, "confirm_duplicate") === "yes";
  if (!name) return { message: "名前を入力してください。", needsConfirmation: false, pendingName: "" };

  const existing = await sql`
    SELECT id FROM members
    WHERE organization_id = ${user.organization_id}
      AND lower(regexp_replace(name, '\\s+', ' ', 'g')) = lower(regexp_replace(${name}, '\\s+', ' ', 'g'))
    LIMIT 1
  `;

  if (existing.rowCount > 0 && !confirmed) {
    return {
      message: "同じ名前のメンバーがすでに登録されています。追加する場合は確認して登録してください。",
      needsConfirmation: true,
      pendingName: name,
    };
  }

  await sql`
    INSERT INTO members (id, organization_id, name, email, password_hash, role)
    VALUES (${crypto.randomUUID()}, ${user.organization_id}, ${name}, ${memberLoginEmail(name)}, ${hashPassword(crypto.randomUUID())}, 'member')
  `;

  revalidatePath("/");
  return { message: "メンバーを登録しました。", needsConfirmation: false, pendingName: "" };
}

export async function createEventAction(formData: FormData) {
  const user = await requireUser();

  const category = readString(formData, "category");
  const opponent = readString(formData, "opponent");
  const title = eventTitle(category, opponent);
  const description = readString(formData, "description");
  const location = readString(formData, "location");
  const range = eventDateTimeRangeToIso(formData);

  if (!category || !range) return;

  await sql`
    INSERT INTO events (id, organization_id, title, description, location, start_at, end_at, created_by)
    VALUES (${crypto.randomUUID()}, ${user.organization_id}, ${title}, ${description || null}, ${location || null}, ${range.startIso}, ${range.endIso}, ${user.id})
  `;

  revalidatePath("/");
}

export async function updateEventAction(formData: FormData) {
  const user = await requireUser();

  const eventId = readString(formData, "event_id");
  const category = readString(formData, "category");
  const opponent = readString(formData, "opponent");
  const title = eventTitle(category, opponent);
  const description = readString(formData, "description");
  const location = readString(formData, "location");
  const range = eventDateTimeRangeToIso(formData);

  if (!eventId || !category || !range) return;

  await sql`
    UPDATE events
    SET title = ${title},
        description = ${description || null},
        location = ${location || null},
        start_at = ${range.startIso},
        end_at = ${range.endIso}
    WHERE id = ${eventId}
      AND organization_id = ${user.organization_id}
  `;

  revalidatePath("/");
}

export async function rsvpAction(formData: FormData) {
  const user = await requireUser();

  const eventId = readString(formData, "event_id");
  const status = readString(formData, "status") as RsvpStatus;
  if (!eventId || !["attending", "declined", "maybe"].includes(status)) return;

  await sql`
    INSERT INTO rsvps (event_id, user_id, status, note, updated_at)
    SELECT ${eventId}, ${user.id}, ${status}, null, NOW()
    WHERE EXISTS (
      SELECT 1 FROM events
      WHERE id = ${eventId}
        AND organization_id = ${user.organization_id}
    )
    ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = EXCLUDED.status,
        note = null,
        updated_at = NOW()
  `;

  revalidatePath("/");
}

export async function deleteMemberAction(formData: FormData) {
  const user = await requireUser();

  const memberId = readString(formData, "member_id");
  if (!memberId || memberId === user.id) return;

  await sql`DELETE FROM members WHERE id = ${memberId} AND organization_id = ${user.organization_id}`;
  revalidatePath("/");
}

export async function deleteEventAction(formData: FormData) {
  const user = await requireUser();

  const eventId = readString(formData, "event_id");
  if (!eventId) return;

  await sql`DELETE FROM events WHERE id = ${eventId} AND organization_id = ${user.organization_id}`;
  revalidatePath("/");
}

export async function suspendOrganizationAction(formData: FormData) {
  const user = await verifyAdminPasscode(readString(formData, "admin_passcode"));
  if (!user) return;

  await sql`UPDATE organizations SET active = FALSE WHERE id = ${user.organization_id}`;
  await logout();
  redirect("/");
}

export async function deleteOrganizationAction(formData: FormData) {
  const user = await verifyAdminPasscode(readString(formData, "admin_passcode"));
  if (!user) return;

  const confirmationCode = readString(formData, "confirmation_code").toUpperCase();
  if (confirmationCode !== user.organization_code) return;

  await sql`DELETE FROM organizations WHERE id = ${user.organization_id}`;
  await logout();
  redirect("/");
}

async function verifyOrganizationPasscode(organizationCode: string, passcode: string) {
  await ensureSchema();
  const code = organizationCode.trim().toUpperCase();
  const { rows } = await sql`
    SELECT id, code, admin_passcode_hash
    FROM organizations
    WHERE code = ${code}
      AND active = TRUE
    LIMIT 1
  `;
  const organization = rows[0] as { id: string; code: string; admin_passcode_hash: string } | undefined;
  if (!organization || !verifyPassword(passcode, organization.admin_passcode_hash)) return null;
  return organization;
}

export async function suspendOrganizationFromTopAction(formData: FormData) {
  const organization = await verifyOrganizationPasscode(readString(formData, "organization_code"), readString(formData, "admin_passcode"));
  if (!organization) return;

  await sql`UPDATE organizations SET active = FALSE WHERE id = ${organization.id}`;
  redirect("/");
}

export async function deleteOrganizationFromTopAction(formData: FormData) {
  const organization = await verifyOrganizationPasscode(readString(formData, "organization_code"), readString(formData, "admin_passcode"));
  if (!organization) return;

  const confirmationCode = readString(formData, "confirmation_code").toUpperCase();
  if (confirmationCode !== organization.code) return;

  await sql`DELETE FROM organizations WHERE id = ${organization.id}`;
  redirect("/");
}
