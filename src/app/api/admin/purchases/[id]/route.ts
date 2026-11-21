import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { purchaseActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("owner", "admin", "manager");
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) throw new ApiError("Invalid purchase order", 400);
    const input = await parseBody(request, purchaseActionSchema);
    if (input.purchase_order_id !== orderId) throw new ApiError("Order ID mismatch", 400, "invalid_order");

    await withTransaction(async (client) => {
      const order = await client.query<{ status: string }>(
        `SELECT status FROM purchase_order WHERE purchase_order_id = $1 FOR UPDATE`, [orderId]);
      if (!order.rows[0]) throw new ApiError("Purchase order not found", 404, "purchase_not_found");
      if (!["Draft", "Ordered"].includes(order.rows[0].status)) {
        throw new ApiError("This purchase order is already finalised", 409, "order_finalised");
      }

      if (input.action === "cancel") {
        await client.query(`UPDATE purchase_order SET status = 'Cancelled', updated_at = now() WHERE purchase_order_id = $1`, [orderId]);
        return;
      }

      const lines = await client.query<{ purchase_order_line_id: number; variant_id: number; quantity: number; received_quantity: number }>(
        `SELECT purchase_order_line_id, variant_id, quantity, received_quantity
         FROM purchase_order_line WHERE purchase_order_id = $1 ORDER BY purchase_order_line_id FOR UPDATE`, [orderId]);
      for (const line of lines.rows) {
        const remaining = line.quantity - line.received_quantity;
        if (remaining <= 0) continue;
        const updated = await client.query(
          `UPDATE product_variant SET qty_in_stock = qty_in_stock + $1 WHERE variant_id = $2`, [remaining, line.variant_id]);
        if (updated.rowCount !== 1) throw new ApiError("Variant no longer exists", 409, "invalid_variant");
        await client.query(
          `UPDATE purchase_order_line SET received_quantity = quantity WHERE purchase_order_line_id = $1`, [line.purchase_order_line_id]);
      }
      await client.query(`UPDATE purchase_order SET status = 'Received', updated_at = now() WHERE purchase_order_id = $1`, [orderId]);
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
