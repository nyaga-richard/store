import { NextResponse } from "next/server";
import { fail, ok, parseBody } from "@/lib/api";
import { setSessionCookie, verifyPassword, type SessionUser } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { queryOne } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, loginSchema);
    const row = await queryOne<SessionUser & { password_hash: string }>(
      `SELECT customer_id, email, first_name, last_name, password_hash FROM customer WHERE email = $1`, [input.email]);
    // Always run a hash comparison so unknown accounts take similar time.
    const valid = await verifyPassword(input.password, row?.password_hash ?? "scrypt$invalid$invalid");
    if (!row || !valid) {
      return NextResponse.json({ ok: false, error: { message: "Invalid email or password", code: "invalid_credentials" } }, { status: 401 });
    }
    const user: SessionUser = { customer_id: row.customer_id, email: row.email, first_name: row.first_name, last_name: row.last_name };
    await setSessionCookie(user);
    await mergeGuestCart(user);
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}
