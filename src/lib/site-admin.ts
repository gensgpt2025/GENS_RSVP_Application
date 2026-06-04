import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifySiteAdmin(username: string, password: string) {
  const expectedUsername = (process.env.SITE_ADMIN_USERNAME ?? "sugaya").trim().toLowerCase();
  const expectedPassword = process.env.SITE_ADMIN_PASSWORD;

  if (!expectedPassword) return false;
  return safeEqual(username.trim().toLowerCase(), expectedUsername) && safeEqual(password, expectedPassword);
}
