import { z } from "zod";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { staffSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const staffUpdateSchema = staffSchema.extend({ staff_id: z.number().int().positive() });
const staffDeleteSchema = z.object({ staff_id: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    const actor = await requireRole("owner", "admin");
    const input = await parseBody(request, staffSchema);
    const password = input.password;
    if (!password) throw new ApiError("A password is required when creating staff", 422, "password_required");
    if (input.role === "owner" && actor.role !== "owner") throw new ApiError("Only an owner can create owners", 403, "forbidden");
    const staffId = await withTransaction(async (client) => {
      const duplicate = await client.query(`SELECT 1 FROM staff_user WHERE email = $1`, [input.email]);
      if (duplicate.rows[0]) throw new ApiError("A staff account with that email already exists", 409, "email_taken");
      const result = await client.query<{ staff_id: number }>(
        `INSERT INTO staff_user (email, password_hash, first_name, last_name, role, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING staff_id`,
        [input.email, await hashPassword(password), input.first_name, input.last_name, input.role, input.is_active ?? true],
      );
      return result.rows[0].staff_id;
    });
    return ok({ staffId }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole("owner", "admin");
    const body = await parseBody(request, staffUpdateSchema);
    await withTransaction(async (client) => {
      const target = await client.query<{ role: string; email: string }>(
        `SELECT role, email FROM staff_user WHERE staff_id = $1 FOR UPDATE`, [body.staff_id]);
      if (!target.rows[0]) throw new ApiError("Staff account not found", 404, "staff_not_found");
      if (target.rows[0].email === actor.email && (body.is_active === false || (body.role && body.role !== target.rows[0].role))) {
        throw new ApiError("You cannot change your own role or disable yourself", 403, "forbidden");
      }
      if (target.rows[0].role === "owner" && body.role && body.role !== "owner") {
        const owners = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM staff_user WHERE role = 'owner' AND is_active = true`);
        if (owners.rows[0].count <= 1) throw new ApiError("The last active owner cannot be demoted", 409, "last_owner");
      }
      const hash = body.password ? await hashPassword(body.password) : null;
      await client.query(
        `UPDATE staff_user SET email = $2, first_name = $3, last_name = $4, role = $5,
                is_active = COALESCE($6, is_active), password_hash = COALESCE($7, password_hash)
         WHERE staff_id = $1`,
        [body.staff_id, body.email, body.first_name, body.last_name, body.role, body.is_active ?? null, hash],
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireRole("owner");
    const { staff_id } = await parseBody(request, staffDeleteSchema);
    await withTransaction(async (client) => {
      const target = await client.query<{ email: string; role: string }>(
        `SELECT email, role FROM staff_user WHERE staff_id = $1 FOR UPDATE`, [staff_id]);
      if (!target.rows[0]) throw new ApiError("Staff account not found", 404, "staff_not_found");
      if (target.rows[0].email === actor.email) throw new ApiError("You cannot delete your own staff account", 403, "forbidden");
      if (target.rows[0].role === "owner") {
        const owners = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM staff_user WHERE role = 'owner' AND is_active = true`);
        if (owners.rows[0].count <= 1) throw new ApiError("The last active owner cannot be deleted", 409, "last_owner");
      }
      await client.query(`DELETE FROM staff_user WHERE staff_id = $1`, [staff_id]);
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
