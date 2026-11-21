import Link from "next/link";
import { listAdminOrders } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const statusId = Number(status) || undefined;
  const [orders, statuses] = await Promise.all([
    listAdminOrders(statusId),
    query<{ order_status_id: number; status_name: string }>(`SELECT order_status_id, status_name FROM order_status WHERE order_status_id <> 1 ORDER BY order_status_id`),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-xl font-bold">Orders</h2><p className="muted">{orders.length} orders</p></div>
        <form action="/admin/orders" method="get" className="flex gap-2">
          <select name="status" defaultValue={statusId ? String(statusId) : ""} className="input w-44">
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item.order_status_id} value={item.order_status_id}>{item.status_name}</option>)}
          </select>
          <button className="btn-secondary py-2.5">Filter</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.order_id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><Link href={`/admin/orders/${order.order_id}`} className="link">#{order.order_id}</Link><span className="muted block">{new Date(order.created_at).toLocaleDateString("en-KE")}</span></td>
                <td className="px-5 py-3"><span className="block">{order.customer_name}</span><span className="muted">{order.email}</span></td>
                <td className="px-5 py-3"><span className="badge bg-brand-50 text-brand-700">{order.status_name}</span></td>
                <td className="px-5 py-3 text-slate-500">{order.payment_status || "—"}</td>
                <td className="px-5 py-3 font-semibold">{formatMoney(Math.round(Number(order.order_total) * 100))}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center muted">No orders in this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
