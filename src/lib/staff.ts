import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { queryOne } from "./db";
import { isSecureRequest, requiredEnv } from "./env";

export const STAFF_COOKIE = "ts_staff";
const MAX_AGE = 60 * 60 * 12;

export type StaffRole = "owner" | "admin" | "manager" | "staff";

export interface StaffUser {
  staff_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
}

interface Payload { sub: number; exp: number; nonce: string }

function sign(body: string) {
  return createHmac("sha256", requiredEnv("SESSION_SECRET")).update(`staff:${body}`).digest("base64url");
}

export async function setStaffSession(staff: StaffUser): Promise<void> {
  const body = Buffer.from(JSON.stringify({
    sub: staff.staff_id, exp: Math.floor(Date.now() / 1000) + MAX_AGE, nonce: randomBytes(8).toString("hex"),
  } satisfies Payload)).toString("base64url");
  const headerList = await headers();
  (await cookies()).set(STAFF_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: isSecureRequest(headerList.get("x-forwarded-proto")),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearStaffSession(): Promise<void> {
  (await cookies()).delete(STAFF_COOKIE);
}

export async function getCurrentStaff(): Promise<StaffUser | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (!Number.isInteger(payload.sub) || payload.exp * 1000 < Date.now()) return null;
    return queryOne<StaffUser>(
      `SELECT staff_id, email, first_name, last_name, role FROM staff_user WHERE staff_id = $1 AND is_active = true`,
      [payload.sub],
    );
  } catch {
    return null;
  }
}
