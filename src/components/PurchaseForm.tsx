"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, toCents } from "@/lib/money";

interface Line { variant_id: number; quantity: string; unit_cost: string }

export function PurchaseForm({ suppliers, variants }: {
  suppliers: { supplier_id: number; supplier_name: string }[];
  variants: { variant_id: number; sku: string; product_name: string; price: string }[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplier_id ?? 0);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ variant_id: variants[0]?.variant_id ?? 0, quantity: "1", unit_cost: "0.00" }]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const total = lines.reduce((sum, line) => sum + toCents(line.unit_cost || "0") * Number(line.quantity || 0), 0);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          expected_date: expectedDate || null,
          notes,
          lines: lines.map((line) => ({ variant_id: Number(line.variant_id), quantity: Number(line.quantity), unit_cost: line.unit_cost })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Create failed");
      router.push(`/admin/purchases/${payload.data.purchaseOrderId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-lg font-bold">New purchase order</h2>
      <div><label className="label">Supplier</label><select className="input" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
        {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.supplier_name}</option>)}
      </select></div>
      <div><label className="label">Expected date</label><input type="date" className="input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
      <div><label className="label">Notes</label><textarea rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <div className="space-y-3">
        <p className="label">Items</p>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <select className="input" value={line.variant_id} onChange={(e) => {
              const id = Number(e.target.value);
              const variant = variants.find((v) => v.variant_id === id);
              updateLine(index, { variant_id: id, unit_cost: variant ? (Number(variant.price) / 100).toFixed(2) : line.unit_cost });
            }}>
              {variants.map((variant) => <option key={variant.variant_id} value={variant.variant_id}>{variant.product_name} · {variant.sku}</option>)}
            </select>
            <input type="number" min={1} className="input" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
            <input className="input" placeholder="Unit cost" value={line.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} />
            <button type="button" className="btn-ghost px-3 text-red-600" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary py-2 text-sm" onClick={() => setLines((current) => [...current, { variant_id: variants[0]?.variant_id ?? 0, quantity: "1", unit_cost: "0.00" }])}>+ Add item</button>
      </div>

      <div className="flex justify-between border-t border-slate-200 pt-4 text-base font-bold"><span>Total</span><span>{formatMoney(total)}</span></div>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <button disabled={pending || !lines.length || !supplierId} className="btn-primary w-full">{pending ? "Creating..." : "Create purchase order"}</button>
    </form>
  );
}
