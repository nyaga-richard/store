import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "./db";
import { appUrl, isSecureRequest, requiredEnv } from "./env";

const scrypt = promisify(scryptCb);
export const SESSION_COOKIE = "ts_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionUser {
  customer_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface SessionPayload {
  sub: number;
  exp: number;
  nonce: string;
}

/** scrypt with a unique random salt, stored as scrypt$salt$hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, hashText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = (await scrypt(password, Buffer.from(saltText, "base64url"), expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", requiredEnv("SESSION_SECRET")).update(payload).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isInteger(parsed.sub) || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = encodeSession({
    sub: user.customer_id,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    nonce: randomBytes(8).toString("hex"),
  });
  const headerList = await headers();
  const secure = isSecureRequest(headerList.get("x-forwarded-proto"));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = decodeSession(token);
  if (!payload) return null;
  const user = await queryOne<SessionUser>(
    `SELECT customer_id, email, first_name, last_name FROM customer WHERE customer_id = $1`,
    [payload.sub],
  );
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account")}`);
  return user;
}

/** Safe same-origin redirect target for post-login navigation. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

export function publicOrigin(): string {
  return appUrl();
}
