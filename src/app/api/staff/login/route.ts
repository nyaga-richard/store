import { NextResponse } from "next/server";
import { fail, ok, parseBody } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { setStaffSession, type StaffUser } from "@/lib/staff";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, loginSchema);
    const staff = await queryOne<StaffUser & { password_hash: string; is_active: boolean }>(
      `SELECT staff_id, email, first_name, last_name, role, password_hash, is_active FROM staff_user WHERE email = $1`,
      [input.email],
    );
    const valid = await verifyPassword(input.password, staff?.password_hash || "scrypt$invalid$invalid");
    if (!staff || !staff.is_active || !valid) {
      return NextResponse.json({ ok: false, error: { message: "Invalid staff credentials", code: "invalid_credentials" } }, { status: 401 });
    }
    await setStaffSession(staff);
    return ok({ staff: { staff_id: staff.staff_id, email: staff.email, role: staff.role } });
  } catch (error) {
    return fail(error);
  }
}
