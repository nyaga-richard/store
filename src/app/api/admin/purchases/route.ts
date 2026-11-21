import { randomBytes } from "node:crypto";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { toCents, toDecimal } from "@/lib/money";
import { purchaseOrderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const input = await parseBody(request, purchaseOrderSchema);
    const orderNumber = `PO-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const purchaseOrderId = await withTransaction(async (client) => {
      const supplier = await client.query(`SELECT supplier_id FROM supplier WHERE supplier_id = $1`, [input.supplier_id]);
      if (!supplier.rows[0]) throw new ApiError("Supplier not found", 404, "supplier_not_found");
      const ids = input.lines.map((line) => line.variant_id);
      if (new Set(ids).size !== ids.length) throw new ApiError("A variant cannot appear twice on one purchase order", 422, "duplicate_line");
      for (const line of input.lines) {
        const variant = await client.query(`SELECT variant_id FROM product_variant WHERE variant_id = $1`, [line.variant_id]);
        if (!variant.rows[0]) throw new ApiError(`Unknown variant ${line.variant_id}`, 422, "invalid_variant");
      }
      const subtotalCents = input.lines.reduce((sum, line) => sum + toCents(line.unit_cost) * line.quantity, 0);
      const order = await client.query<{ purchase_order_id: number }>(
        `INSERT INTO purchase_order (supplier_id, order_number, order_date, expected_date, status, subtotal, notes, created_at, updated_at)
         VALUES ($1,$2,now(),$3,'Draft',$4,$5,now(),now()) RETURNING purchase_order_id`,
        [input.supplier_id, orderNumber, input.expected_date ? new Date(input.expected_date) : null, toDecimal(subtotalCents), input.notes || null],
      );
      const id = order.rows[0].purchase_order_id;
      for (const line of input.lines) {
        await client.query(
          `INSERT INTO purchase_order_line (purchase_order_id, variant_id, quantity, unit_cost)
           VALUES ($1,$2,$3,$4)`,
          [id, line.variant_id, line.quantity, toDecimal(toCents(line.unit_cost))],
        );
      }
      return id;
    });
    return ok({ purchaseOrderId }, 201);
  } catch (error) {
    return fail(error);
  }
}
