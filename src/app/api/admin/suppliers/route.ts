import { z } from "zod";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { query, withTransaction } from "@/lib/db";
import { supplierSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const input = await parseBody(request, supplierSchema);
    const result = await query<{ supplier_id: number }>(
      `INSERT INTO supplier (supplier_name, contact_name, email, phone, address_line1, city, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING supplier_id`,
      [input.supplier_name, input.contact_name || null, input.email || null, input.phone || null, input.address_line1 || null, input.city || null],
    );
    return ok({ supplierId: result[0].supplier_id }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail(new ApiError("A supplier with that name already exists", 409, "supplier_exists"));
    }
    return fail(error);
  }
}

const updateSchema = supplierSchema.extend({ supplier_id: z.number().int().positive() });

export async function PATCH(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const input = await parseBody(request, updateSchema);
    await query(
      `UPDATE supplier SET supplier_name = $2, contact_name = $3, email = $4, phone = $5,
              address_line1 = $6, city = $7 WHERE supplier_id = $1`,
      [input.supplier_id, input.supplier_name, input.contact_name || null, input.email || null,
        input.phone || null, input.address_line1 || null, input.city || null],
    );
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

const deleteSchema = z.object({ supplier_id: z.number().int().positive() });

export async function DELETE(request: Request) {
  try {
    await requireRole("owner", "admin");
    const input = await parseBody(request, deleteSchema);
    await withTransaction(async (client) => {
      const used = await client.query(`SELECT 1 FROM purchase_order WHERE supplier_id = $1 LIMIT 1`, [input.supplier_id]);
      if (used.rows[0]) throw new ApiError("Supplier has purchase orders and cannot be deleted", 409, "supplier_has_orders");
      await client.query(`DELETE FROM supplier WHERE supplier_id = $1`, [input.supplier_id]);
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
