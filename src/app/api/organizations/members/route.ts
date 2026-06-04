import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import type { Member } from "@/lib/types";

export async function GET(request: Request) {
  await ensureSchema();
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ members: [] });
  }

  const { rows } = await sql`
    SELECT members.id, members.name, members.role
    FROM members
    INNER JOIN organizations ON organizations.id = members.organization_id
    WHERE organizations.code = ${code}
      AND organizations.active = TRUE
      AND members.active = TRUE
    ORDER BY
      CASE WHEN members.name ~ '^[0-9]+' THEN 0 ELSE 1 END,
      CASE WHEN members.name ~ '^[0-9]+' THEN substring(members.name from '^[0-9]+')::int ELSE NULL END ASC,
      members.name ASC,
      members.created_at ASC
  `;

  return NextResponse.json({
    members: (rows as Pick<Member, "id" | "name" | "role">[]).map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
    })),
  });
}
