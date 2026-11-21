import { NextResponse } from "next/server";
import { fail, ok, parseBody } from "@/lib/api";
import { hashPassword, setSessionCookie, type SessionUser } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { queryOne } from "@/lib/db";
import { registerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, registerSchema);
    const existing = await queryOne<{ customer_id: number }>(`SELECT customer_id FROM customer WHERE email = $1`, [input.email]);
    if (existing) return NextResponse.json({ ok: false, error: { message: "An account with that email already exists", code: "email_taken" } }, { status: 409 });

    const password_hash = await hashPassword(input.password);
    let user: SessionUser;
    try {
      const row = await queryOne<SessionUser>(
        `INSERT INTO customer (email, password_hash, first_name, last_name, phone, created_at)
         VALUES ($1,$2,$3,$4,$5,now())
         RETURNING customer_id, email, first_name, last_name`,
        [input.email, password_hash, input.first_name, input.last_name, input.phone || null],
      );
      if (!row) throw new Error("Insert returned no row");
      user = row;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ ok: false, error: { message: "An account with that email already exists", code: "email_taken" } }, { status: 409 });
      }
      throw error;
    }
    await setSessionCookie(user);
    await mergeGuestCart(user);
    return ok({ user }, 201);
  } catch (error) {
    return fail(error);
  }
}
