import Link from "next/link";
import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/admin-data";
import { formatMoney, toCents } from "@/lib/money";
import { PurchaseActions } from "@/components/PurchaseActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase order" };

export default async function AdminPurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const order = await getPurchaseOrder(orderId);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/purchases" className="link text-sm">← Purchases</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">{order.order_number}</h2><p className="muted">{order.supplier_name} · {new Date(order.order_date).toLocaleDateString("en-KE")}</p></div>
        <span className="badge bg-brand-50 text-brand-700">{order.status}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Unit cost</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Line total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.lines.map((line) => (
                <tr key={line.purchase_order_line_id}>
                  <td className="px-4 py-3">{line.product_name}<span className="muted block font-mono text-xs">{line.sku}</span></td>
                  <td className="px-4 py-3">{line.quantity}</td>
                  <td className="px-4 py-3">{formatMoney(toCents(line.unit_cost))}</td>
                  <td className="px-4 py-3">{line.received_quantity} / {line.quantity}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(toCents(line.unit_cost) * line.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.notes && <p className="muted border-t border-slate-100 p-4 text-sm">{order.notes}</p>}
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="font-semibold">Order total</h3>
            <p className="mt-2 text-2xl font-bold">{formatMoney(toCents(order.subtotal))}</p>
            {order.expected_date && <p className="muted mt-1">Expected: {new Date(order.expected_date).toLocaleDateString("en-KE")}</p>}
          </section>
          <PurchaseActions orderId={order.purchase_order_id} status={order.status} />
        </div>
      </div>
    </div>
  );
}
