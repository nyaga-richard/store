import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/admin";
import { queryOne, withTransaction } from "@/lib/db";
import { settlePayment } from "@/lib/checkout";
import { adminOrderStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ApiError("Invalid order", 400);
    const input = await parseBody(request, adminOrderStatusSchema);

    // Cart is hidden from admin; Paid is set only by a confirmed payment.
    if (input.order_status_id === 1 || input.order_status_id === 3) {
      throw new ApiError("Paid status is set by payment confirmation; Cart is not an admin state", 422, "invalid_status");
    }

    const order = await queryOne<{ order_status_id: number }>(
      `SELECT order_status_id FROM customer_order WHERE order_id = $1`, [orderId]);
    if (!order) throw new ApiError("Order not found", 404, "order_not_found");
    if (order.order_status_id === 1) throw new ApiError("Carts cannot be managed here", 422, "invalid_status");
    if (order.order_status_id === 6 && input.order_status_id !== 6) {
      throw new ApiError("A cancelled order cannot be reactivated (stock was returned)", 409, "cancelled_order");
    }

    if (input.order_status_id === 6) {
      if (order.order_status_id === 6) return ok({ updated: true });
      const payment = await queryOne<{ provider_reference: string }>(
        `SELECT provider_reference FROM payment WHERE order_id = $1 ORDER BY payment_id DESC LIMIT 1`, [orderId]);
      const applied = await settlePayment({ reference: payment?.provider_reference || `admin_${orderId}`, orderId, type: "payment.refunded" });
      if (!applied) {
        await withTransaction(async (client) => {
          await client.query(`UPDATE customer_order SET order_status_id = 6, updated_at = now() WHERE order_id = $1`, [orderId]);
          await client.query(
            `UPDATE product_variant v SET qty_in_stock = v.qty_in_stock + ol.quantity
             FROM order_line ol WHERE ol.order_id = $1 AND ol.variant_id = v.variant_id`, [orderId]);
        });
      }
      return ok({ updated: true });
    }

    await withTransaction(async (client) => {
      const status = await client.query(`SELECT order_status_id FROM order_status WHERE order_status_id = $1`, [input.order_status_id]);
      if (!status.rows[0]) throw new ApiError("Unknown order status", 422, "invalid_status");
      await client.query(`UPDATE customer_order SET order_status_id = $2, updated_at = now() WHERE order_id = $1`,
        [orderId, input.order_status_id]);
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
