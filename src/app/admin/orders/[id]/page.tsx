import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { formatMoney, toCents } from "@/lib/money";
import { OrderStatusForm } from "@/components/OrderStatusForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order detail" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await queryOne<{
    order_id: number; order_status_id: number; status_name: string; customer_name: string; email: string;
    subtotal: string | null; discount_total: string | null; shipping_cost: string | null; order_total: string | null;
    ship_name: string | null; ship_address_line1: string | null; ship_city: string | null; ship_country: string | null;
    payment_status: string | null; payment_reference: string | null; created_at: string;
  }>(
    `SELECT o.order_id, o.order_status_id, os.status_name, CONCAT(c.first_name,' ',c.last_name) AS customer_name,
            c.email, o.subtotal::text, o.discount_total::text, o.shipping_cost::text, o.order_total::text,
            o.ship_name, o.ship_address_line1, o.ship_city, o.ship_country, o.created_at::text,
            (SELECT p.payment_status FROM payment p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_status,
            (SELECT p.provider_reference FROM payment p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_reference
     FROM customer_order o
     JOIN order_status os ON os.order_status_id = o.order_status_id
     JOIN customer c ON c.customer_id = o.customer_id
     WHERE o.order_id = $1 AND o.order_status_id <> 1`, [orderId]);
  if (!order) notFound();

  const lines = await query<{
    order_line_id: number; product_name: string; sku: string; option_summary: string | null;
    quantity: number; unit_price: string; discount_amount: string | null;
  }>(
    `SELECT order_line_id, product_name, sku, option_summary, quantity, unit_price::text, discount_amount::text
     FROM order_line WHERE order_id = $1 ORDER BY order_line_id`, [orderId]);

  return (
    <div>
      <Link href="/admin/orders" className="link text-sm">← Orders</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Order #{order.order_id}</h2><p className="muted">{order.customer_name} · {order.email}</p></div>
        <span className="badge bg-brand-50 text-brand-700">{order.status_name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="font-semibold">Items</h3>
            <ul className="mt-4 divide-y divide-slate-100">
              {lines.map((line) => (
                <li key={line.order_line_id} className="flex justify-between gap-4 py-3 first:pt-0">
                  <div>
                    <p className="text-sm font-semibold">{line.product_name}</p>
                    <p className="muted">{line.option_summary || line.sku} · Qty {line.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney((toCents(line.unit_price) - toCents(line.discount_amount || 0)) * line.quantity)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h3 className="font-semibold">Ship to</h3>
            <address className="muted mt-2 not-italic text-sm">
              {order.ship_name}<br />{order.ship_address_line1}<br />{order.ship_city} {order.ship_country}
            </address>
            <p className="muted mt-3 text-xs">Payment: {order.payment_status || "—"} · {order.payment_reference || "—"}</p>
          </section>
        </div>

        <div className="space-y-6">
          <OrderStatusForm orderId={order.order_id} currentStatusId={order.order_status_id} />
          <section className="card p-5">
            <h3 className="font-semibold">Totals</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(toCents(order.subtotal || 0) + toCents(order.discount_total || 0))}</dd></div>
              <div className="flex justify-between text-brand-700"><dt>Discount</dt><dd>−{formatMoney(toCents(order.discount_total || 0))}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd>{formatMoney(toCents(order.shipping_cost || 0))}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatMoney(toCents(order.order_total || 0))}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
