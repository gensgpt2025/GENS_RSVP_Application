"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginAsMember, logout, requireUser } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";
import { hashPassword } from "@/lib/security";
import { verifySiteAdmin } from "@/lib/site-admin";
import type { RsvpStatus } from "@/lib/types";

export type MemberFormState = {
  message: string;
  needsConfirmation: boolean;
  pendingName: string;
};

export type OrganizationFormState = {
  message: string;
};

export type SiteAdminOverviewState = {
  message: string;
  organizations: {
    id: string;
    name: string;
    code: string;
    active: boolean;
    members: { id: string; name: string; active: boolean }[];
    events: { id: string; title: string; location: string | null; start_at: string; end_at: string }[];
  }[];
};

function readString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function siteAdminIsValid(formData: FormData) {
  return verifySiteAdmin(readString(formData, "site_admin_username"), readString(formData, "site_admin_password"));
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
  const startHour = readString(formData, "start_hour");
  const startMinute = readString(formData, "start_minute");
  const endHour = readString(formData, "end_hour");
  const endMinute = readString(formData, "end_minute");
  if (eventDate || startHour || startMinute || endHour || endMinute) {
    return eventDateAndTimesToIso(eventDate, `${startHour}:${startMinute}`, `${endHour}:${endMinute}`);
  }

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
  if (!siteAdminIsValid(formData)) {
    return { message: "サイト管理者の認証に失敗しました。" };
  }

  const name = readString(formData, "organization_name");
  const code = readString(formData, "organization_code").toUpperCase();
  const adminName = readString(formData, "admin_name") || "メンバー";

  if (!name || !code) {
    return { message: "団体名と団体コードを入力してください。" };
  }

  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    return { message: "団体コードは3〜24文字の英数字、ハイフン、アンダーバーで設定してください。" };
  }

  const organizationId = crypto.randomUUID();
  try {
    await sql`
      INSERT INTO organizations (id, name, code, admin_passcode_hash)
      VALUES (${organizationId}, ${name}, ${code}, ${hashPassword(crypto.randomUUID())})
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

export async function getSiteAdminOverviewAction(_: SiteAdminOverviewState, formData: FormData): Promise<SiteAdminOverviewState> {
  await ensureSchema();
  if (!siteAdminIsValid(formData)) {
    return { message: "サイト管理者の認証に失敗しました。", organizations: [] };
  }

  const [organizations, members, events] = await Promise.all([
    sql`
      SELECT id, name, code, active
      FROM organizations
      ORDER BY created_at ASC
    `,
    sql`
      SELECT id, organization_id, name, active
      FROM members
      ORDER BY
        CASE WHEN name ~ '^[0-9]+' THEN 0 ELSE 1 END,
        CASE WHEN name ~ '^[0-9]+' THEN substring(name from '^[0-9]+')::int ELSE NULL END ASC,
        name ASC,
        created_at ASC
    `,
    sql`
      SELECT id, organization_id, title, location, start_at, end_at
      FROM events
      ORDER BY start_at DESC
    `,
  ]);

  const memberRows = members.rows as { id: string; organization_id: string; name: string; active: boolean }[];
  const eventRows = events.rows as {
    id: string;
    organization_id: string;
    title: string;
    location: string | null;
    start_at: string;
    end_at: string;
  }[];

  return {
    message: "一覧を取得しました。",
    organizations: (organizations.rows as { id: string; name: string; code: string; active: boolean }[]).map((organization) => ({
      id: organization.id,
      name: organization.name,
      code: organization.code,
      active: organization.active,
      members: memberRows
        .filter((member) => member.organization_id === organization.id)
        .map((member) => ({ id: member.id, name: member.name, active: member.active })),
      events: eventRows
        .filter((event) => event.organization_id === organization.id)
        .map((event) => ({
          id: event.id,
          title: event.title,
          location: event.location,
          start_at: new Date(event.start_at).toISOString(),
          end_at: new Date(event.end_at).toISOString(),
        })),
    })),
  };
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

export async function deleteOrganizationFromTopAction(formData: FormData) {
  if (!siteAdminIsValid(formData)) return;

  const confirmationCode = readString(formData, "confirmation_code").toUpperCase();
  const code = readString(formData, "organization_code").toUpperCase();
  if (confirmationCode !== code) return;

  await ensureSchema();
  await sql`DELETE FROM organizations WHERE code = ${code}`;
  redirect("/");
}

export async function changeOrganizationPasscodeFromTopAction(formData: FormData) {
  if (!siteAdminIsValid(formData)) return;

  const code = readString(formData, "organization_code").toUpperCase();
  const newPasscode = readString(formData, "new_admin_passcode");
  if (!code || newPasscode.length < 4) return;

  await ensureSchema();
  await sql`
    UPDATE organizations
    SET admin_passcode_hash = ${hashPassword(newPasscode)}
    WHERE code = ${code}
  `;
  redirect("/");
}
