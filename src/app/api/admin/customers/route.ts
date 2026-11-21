import { NextResponse } from "next/server";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { adminCustomerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const input = await parseBody(request, adminCustomerSchema);
    if (!input.password) throw new ApiError("A password is required when creating a customer", 422, "password_required");
    if (await queryOne(`SELECT customer_id FROM customer WHERE email = $1`, [input.email])) {
      throw new ApiError("A customer with that email already exists", 409, "email_taken");
    }
    const customerId = await queryOne<{ customer_id: number }>(
      `INSERT INTO customer (email, password_hash, first_name, last_name, phone, created_at)
       VALUES ($1,$2,$3,$4,$5,now()) RETURNING customer_id`,
      [input.email, await hashPassword(input.password), input.first_name, input.last_name, input.phone || null],
    );
    return ok({ customerId: customerId!.customer_id }, 201);
  } catch (error) {
    return fail(error);
  }
}
