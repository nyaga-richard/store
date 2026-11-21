import Link from "next/link";
import { listPurchaseOrders } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { formatMoney, toCents } from "@/lib/money";
import { PurchaseForm } from "@/components/PurchaseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchases" };

export default async function AdminPurchasesPage() {
  const [orders, suppliers, variants] = await Promise.all([
    listPurchaseOrders(),
    query<{ supplier_id: number; supplier_name: string }>(`SELECT supplier_id, supplier_name FROM supplier ORDER BY supplier_name`),
    query<{ variant_id: number; sku: string; product_name: string; price: string }>(
      `SELECT v.variant_id, v.sku, p.product_name, v.price::text FROM product_variant v JOIN product p ON p.product_id = v.product_id ORDER BY p.product_name, v.variant_id`),
  ]);
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Purchases</h2><p className="muted">Raise purchase orders from suppliers and receive stock into inventory.</p></div>
      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <PurchaseForm suppliers={suppliers} variants={variants} />
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.purchase_order_id}>
                  <td className="px-4 py-3"><Link href={`/admin/purchases/${order.purchase_order_id}`} className="link">{order.order_number}</Link><span className="muted block">{new Date(order.order_date).toLocaleDateString("en-KE")}</span></td>
                  <td className="px-4 py-3">{order.supplier_name}<span className="muted block">{order.line_count} lines</span></td>
                  <td className="px-4 py-3"><span className="badge bg-brand-50 text-brand-700">{order.status}</span></td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(toCents(order.subtotal))}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center muted">No purchase orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
