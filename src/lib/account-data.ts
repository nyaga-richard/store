import "server-only";
import { query, queryOne } from "./db";
import type { OrderDetail, OrderSummary } from "./types";

export async function getOrders(customerId: number): Promise<OrderSummary[]> {
  return query<OrderSummary>(
    `SELECT o.order_id, o.order_date::text, os.status_name,
            COALESCE(o.order_total, 0) * 100 AS order_total_cents,
            COALESCE((SELECT SUM(ol.quantity) FROM order_line ol WHERE ol.order_id = o.order_id), 0)::int AS item_count,
            o.created_at::text
     FROM customer_order o JOIN order_status os ON os.order_status_id = o.order_status_id
     WHERE o.customer_id = $1 AND o.order_status_id <> 1
     ORDER BY o.order_id DESC`, [customerId],
  ).then((rows) => rows.map((row) => ({ ...row, order_total_cents: Number(row.order_total_cents) })));
}

export async function getOrderDetail(customerId: number, orderId: number): Promise<OrderDetail | null> {
  const order = await queryOne<{
    order_id: number; order_date: string | null; status_name: string;
    subtotal: string | null; discount_total: string | null; order_total: string | null; shipping_cost: string | null;
    ship_name: string | null; ship_address_line1: string | null; ship_address_line2: string | null;
    ship_city: string | null; ship_region: string | null; ship_postal_code: string | null; ship_country: string | null;
    created_at: string; payment_status: string | null; payment_reference: string | null; item_count: number;
  }>(
    `SELECT o.order_id, o.order_date::text, os.status_name, o.subtotal::text, o.discount_total::text,
            o.order_total::text, o.shipping_cost::text, o.ship_name, o.ship_address_line1, o.ship_address_line2,
            o.ship_city, o.ship_region, o.ship_postal_code, o.ship_country, o.created_at::text,
            (SELECT p.payment_status FROM payment p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_status,
            (SELECT p.provider_reference FROM payment p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_reference,
            (SELECT COUNT(*)::int FROM order_line ol WHERE ol.order_id = o.order_id) AS item_count
     FROM customer_order o JOIN order_status os ON os.order_status_id = o.order_status_id
     WHERE o.order_id = $1 AND o.customer_id = $2 AND o.order_status_id <> 1`, [orderId, customerId],
  );
  if (!order) return null;

  const lines = await query<{
    order_line_id: number; product_name: string; sku: string; option_summary: string | null;
    quantity: number; unit_price: string; discount_amount: string | null; reviewed: boolean;
  }>(
    `SELECT ol.order_line_id, ol.product_name, ol.sku, ol.option_summary, ol.quantity,
            ol.unit_price::text, COALESCE(ol.discount_amount, 0)::text AS discount_amount,
            EXISTS(SELECT 1 FROM review r WHERE r.order_line_id = ol.order_line_id) AS reviewed
     FROM order_line ol WHERE ol.order_id = $1 ORDER BY ol.order_line_id`, [orderId],
  );

  const cents = (value: string | null) => Math.round(Number(value || 0) * 100);
  return {
    ...order,
    subtotal_cents: cents(order.subtotal),
    discount_cents: cents(order.discount_total),
    shipping_cents: cents(order.shipping_cost),
    order_total_cents: cents(order.order_total),
    lines: lines.map((line) => ({
      ...line,
      unit_price_cents: cents(line.unit_price),
      discount_cents: cents(line.discount_amount),
    })),
  };
}
