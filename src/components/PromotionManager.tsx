"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Promotion {
  promotion_id: number;
  promotion_name: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  start_date: string;
  end_date: string;
  product_count: number;
  active: boolean;
}

function localInput(value: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function defaultStart() { return localInput(new Date().toISOString()); }
function defaultEnd() { return localInput(new Date(Date.now() + 30 * 86_400_000).toISOString()); }

export function PromotionManager({ promotions, products }: {
  promotions: Promotion[];
  products: { product_id: number; product_name: string }[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    promotion_name: "", description: "", discount_type: "Percentage", discount_value: "10.00",
    start_date: defaultStart(), end_date: defaultEnd(), productIds: [] as number[],
  });

  function startEdit(promotion: Promotion) {
    setEditingId(promotion.promotion_id);
    setForm({
      promotion_name: promotion.promotion_name,
      description: promotion.description || "",
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: localInput(promotion.start_date),
      end_date: localInput(promotion.end_date),
      productIds: [],
    });
    setMessage("For edits, leave products unchecked to keep the existing product links.");
  }

  function reset() {
    setEditingId(null);
    setForm({ promotion_name: "", description: "", discount_type: "Percentage", discount_value: "10.00",
      start_date: defaultStart(), end_date: defaultEnd(), productIds: [] });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const body = editingId
        ? { ...form, promotion_id: editingId, productIds: form.productIds.length ? form.productIds : undefined }
        : form;
      const response = await fetch("/api/admin/promotions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage(editingId ? "Promotion updated." : "Promotion created.");
      reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(promotionId: number) {
    if (!confirm("Delete this promotion?")) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/promotions", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotion_id: promotionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Delete failed");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="card h-fit space-y-4 p-6">
        <h2 className="text-lg font-bold">{editingId ? "Edit promotion" : "New promotion"}</h2>
        <div><label className="label">Name</label><input required className="input" value={form.promotion_name} onChange={(e) => setForm({ ...form, promotion_name: e.target.value })} /></div>
        <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Type</label><select className="input" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
            <option value="Percentage">Percentage</option><option value="Fixed">Fixed (KES)</option>
          </select></div>
          <div><label className="label">Value</label><input required className="input" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Starts</label><input type="datetime-local" required className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><label className="label">Ends</label><input type="datetime-local" required className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>
        <fieldset>
          <legend className="label">Applies to products</legend>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {products.map((product) => (
              <label key={product.product_id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-brand-700" checked={form.productIds.includes(product.product_id)}
                  onChange={(event) => setForm({ ...form, productIds: event.target.checked
                    ? [...form.productIds, product.product_id]
                    : form.productIds.filter((id) => id !== product.product_id) })} />
                <span className="truncate">{product.product_name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {message && <p className="text-sm text-brand-700">{message}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 py-2.5">{pending ? "Saving..." : editingId ? "Update" : "Create promotion"}</button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary py-2.5">Cancel</button>}
        </div>
      </form>

      <div className="space-y-3">
        {promotions.map((promotion) => (
          <div key={promotion.promotion_id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">{promotion.promotion_name} {promotion.active && <span className="badge ml-2 bg-brand-50 text-brand-700">Active</span>}</p>
              <p className="muted">{promotion.discount_type}: {promotion.discount_value} · {promotion.product_count} products</p>
              <p className="muted">{new Date(promotion.start_date.replace(" ", "T")).toLocaleDateString("en-KE")} → {new Date(promotion.end_date.replace(" ", "T")).toLocaleDateString("en-KE")}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <button type="button" className="link" onClick={() => startEdit(promotion)}>Edit</button>
              <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => void remove(promotion.promotion_id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
