import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { isSecureRequest, requiredEnv } from "./env";

export const GUEST_CART_COOKIE = "ts_cart";
export interface GuestCartLine {
  variantId: number;
  quantity: number;
}

const COOKIE_AGE = 60 * 60 * 24 * 60;

function sign(body: string) {
  return createHmac("sha256", requiredEnv("SESSION_SECRET")).update(`cart:${body}`).digest("base64url");
}

export async function readGuestCart(): Promise<GuestCartLine[]> {
  const token = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  if (!token) return [];
  const [body, signature] = token.split(".");
  if (!body || !signature) return [];
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return [];
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is GuestCartLine =>
        Number.isInteger(line?.variantId) && Number.isInteger(line?.quantity) && line.quantity > 0 && line.quantity <= 99,
    );
  } catch {
    return [];
  }
}

export async function writeGuestCart(lines: GuestCartLine[]): Promise<void> {
  const body = Buffer.from(JSON.stringify(lines.slice(0, 100))).toString("base64url");
  const headerList = await headers();
  (await cookies()).set(GUEST_CART_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: isSecureRequest(headerList.get("x-forwarded-proto")),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_AGE,
  });
}

export async function clearGuestCart(): Promise<void> {
  (await cookies()).delete(GUEST_CART_COOKIE);
}
