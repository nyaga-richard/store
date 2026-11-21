import Link from "next/link";
import { getAdminStats, listAdminOrders } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const [stats, orders, lowStock, statusRows] = await Promise.all([
    getAdminStats(),
    listAdminOrders(),
    query<{ variant_id: number; sku: string; qty_in_stock: number; product_name: string }>(
      `SELECT v.variant_id, v.sku, v.qty_in_stock, p.product_name
       FROM product_variant v JOIN product p ON p.product_id = v.product_id
       WHERE v.qty_in_stock < 5 ORDER BY v.qty_in_stock LIMIT 8`),
    query<{ status_name: string; count: number }>(
      `SELECT os.status_name, COUNT(o.order_id)::int AS count
       FROM order_status os LEFT JOIN customer_order o ON o.order_status_id = os.order_status_id AND o.order_status_id <> 1
       WHERE os.order_status_id <> 1
       GROUP BY os.order_status_id, os.status_name ORDER BY os.order_status_id`),
  ]);

  const cards = [
    { label: "Orders", value: String(stats.orders), href: "/admin/orders" },
    { label: "Revenue (booked)", value: formatMoney(stats.revenue_cents), href: "/admin/orders" },
    { label: "Customers", value: String(stats.customers), href: "/admin" },
    { label: "Products", value: String(stats.products), href: "/admin/products" },
    { label: "Low stock variants", value: String(stats.lowStock), href: "/admin/products" },
    { label: "Active promotions", value: String(stats.activePromotions), href: "/admin/promotions" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-5 transition hover:border-brand-600">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Orders by status</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {statusRows.map((row) => (
              <li key={row.status_name} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-600">{row.status_name}</span><span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Low stock</h2>
            <Link href="/admin/products" className="link text-sm">All products →</Link>
          </div>
          {lowStock.length === 0 ? <p className="muted mt-4">Nothing below 5 units.</p> : (
            <ul className="mt-4 space-y-2 text-sm">
              {lowStock.map((row) => (
                <li key={row.variant_id} className="flex justify-between gap-3">
                  <span className="truncate text-slate-600">{row.product_name} <span className="font-mono text-xs">{row.sku}</span></span>
                  <span className={`font-semibold ${row.qty_in_stock === 0 ? "text-red-600" : "text-amber-600"}`}>{row.qty_in_stock}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="link text-sm">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 8).map((order) => (
                <tr key={order.order_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3"><Link href={`/admin/orders/${order.order_id}`} className="link">#{order.order_id}</Link></td>
                  <td className="px-5 py-3">{order.customer_name}</td>
                  <td className="px-5 py-3"><span className="badge bg-brand-50 text-brand-700">{order.status_name}</span></td>
                  <td className="px-5 py-3 font-semibold">{formatMoney(Math.round(Number(order.order_total) * 100))}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
