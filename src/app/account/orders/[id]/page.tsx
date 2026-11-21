import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/account-data";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { ReviewForm } from "@/components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; gateway?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { new: justPlaced, gateway } = await searchParams;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const order = await getOrderDetail(user.customer_id, orderId);
  if (!order) notFound();

  return (
    <div>
      <Link href="/account/orders" className="link text-sm">← All orders</Link>
      {justPlaced && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <strong>Thank you!</strong> Your order has been received. Payment status: <strong>{order.payment_status || "Pending"}</strong>.
          {gateway === "mpesa" && <p className="mt-1">Complete the M-Pesa prompt on your phone. This page updates once Safaricom confirms payment.</p>}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Order #{order.order_id}</h2>
        <span className="badge bg-brand-50 text-brand-700">{order.status_name}</span>
      </div>
      <p className="muted mt-1">Placed {new Date(order.order_date || order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="font-semibold">Items</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {order.lines.map((line) => (
              <li key={line.order_line_id} className="py-4 first:pt-0">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{line.product_name}</p>
                    <p className="muted">{line.option_summary || line.sku} · Qty {line.quantity}</p>
                  </div>
                  <p className="text-sm font-bold">{formatMoney((line.unit_price_cents - line.discount_cents) * line.quantity)}</p>
                </div>
                {["Delivered", "Shipped"].includes(order.status_name) && (
                  line.reviewed
                    ? <p className="mt-2 text-xs text-brand-700">✓ You reviewed this item</p>
                    : <ReviewForm orderLineId={line.order_line_id} />
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="font-semibold">Totals</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(order.subtotal_cents + order.discount_cents)}</dd></div>
              <div className="flex justify-between text-brand-700"><dt>Promotions</dt><dd>−{formatMoney(order.discount_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd>{formatMoney(order.shipping_cents)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatMoney(order.order_total_cents)}</dd></div>
            </dl>
            <p className="muted mt-3">Payment: {order.payment_status || "—"} · Ref: {order.payment_reference || "—"}</p>
          </section>

          <section className="card p-5">
            <h3 className="font-semibold">Shipping to</h3>
            <address className="muted mt-3 not-italic">
              {order.ship_name}<br />
              {order.ship_address_line1}<br />
              {order.ship_address_line2 && <>{order.ship_address_line2}<br /></>}
              {order.ship_city}{order.ship_region ? `, ${order.ship_region}` : ""} {order.ship_postal_code}<br />
              {order.ship_country}
            </address>
          </section>
        </div>
      </div>
    </div>
  );
}
