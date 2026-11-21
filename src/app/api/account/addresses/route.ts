import { NextResponse } from "next/server";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { z } from "zod";
import { addressSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, addressSchema);
    await withTransaction(async (client) => {
      if (input.is_default) await client.query(`UPDATE address SET is_default = false WHERE customer_id = $1`, [user.customer_id]);
      await client.query(
        `INSERT INTO address (customer_id, address_line1, address_line2, city, region, postal_code, country_id, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user.customer_id, input.address_line1, input.address_line2 || null, input.city, input.region || null,
          input.postal_code || null, input.country_id, input.is_default ?? false],
      );
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return fail(error);
  }
}

const updateSchema = z.object({
  addressId: z.number().int().positive(),
  is_default: z.boolean().optional(),
}).merge(addressSchema.partial());

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, updateSchema);
    await withTransaction(async (client) => {
      const existing = await client.query<{ address_id: number }>(
        `SELECT address_id FROM address WHERE address_id = $1 AND customer_id = $2 FOR UPDATE`, [input.addressId, user.customer_id]);
      if (!existing.rows[0]) throw new ApiError("Address not found", 404, "address_not_found");
      if (input.is_default === true) {
        await client.query(`UPDATE address SET is_default = false WHERE customer_id = $1`, [user.customer_id]);
      }
      await client.query(
        `UPDATE address SET address_line1 = COALESCE($3, address_line1), address_line2 = $4, city = COALESCE($5, city),
                region = $6, postal_code = $7, country_id = COALESCE($8, country_id),
                is_default = COALESCE($9, is_default)
         WHERE address_id = $1 AND customer_id = $2`,
        [input.addressId, user.customer_id, input.address_line1 ?? null, input.address_line2 ?? null,
          input.city ?? null, input.region ?? null, input.postal_code ?? null, input.country_id ?? null,
          input.is_default ?? null],
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

const deleteSchema = z.object({ addressId: z.number().int().positive() });

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, deleteSchema);
    const owned = await query(`SELECT address_id FROM address WHERE address_id = $1 AND customer_id = $2`, [input.addressId, user.customer_id]);
    if (!owned.length) {
      return NextResponse.json({ ok: false, error: { message: "Address not found", code: "address_not_found" } }, { status: 404 });
    }
    await query(`DELETE FROM address WHERE address_id = $1 AND customer_id = $2`, [input.addressId, user.customer_id]);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
