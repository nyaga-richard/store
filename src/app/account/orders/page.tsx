import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrders } from "@/lib/account-data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getOrders(user.customer_id);

  if (!orders.length) return (
    <div className="card p-10 text-center">
      <p className="font-semibold">No orders yet</p>
      <p className="muted mt-1">Once you place an order it will appear here.</p>
      <Link href="/products" className="btn-primary mt-5">Start shopping</Link>
    </div>
  );

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Order history</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <Link key={order.order_id} href={`/account/orders/${order.order_id}`} className="card flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-brand-600">
            <div>
              <p className="font-semibold">Order #{order.order_id}</p>
              <p className="muted">{new Date(order.order_date || order.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })} · {order.item_count} items</p>
            </div>
            <div className="text-right">
              <span className="badge bg-brand-50 text-brand-700">{order.status_name}</span>
              <p className="mt-1 font-bold">{formatMoney(order.order_total_cents)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
