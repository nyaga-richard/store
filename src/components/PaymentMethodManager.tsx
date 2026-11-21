"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethodView } from "@/lib/types";

export function PaymentMethodManager({ methods, provider }: { methods: PaymentMethodView[]; provider: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(methods.length === 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ provider_token: "", card_brand: "", last_four: "", expiry_month: "", expiry_year: "", is_default: methods.length === 0 });

  async function request(method: "POST" | "PATCH" | "DELETE", body: object) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account/payment-methods", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Request failed");
      router.refresh();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">Payment methods</h2>
        <button type="button" className="btn-secondary py-2" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add card"}</button>
      </div>
      <div className="mb-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
        Only provider tokens are stored. In demo mode use <code>tok_demo_4242</code>; with Stripe, use a <code>pm_...</code> token from Stripe.js.
      </div>

      {showForm && (
        <form className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const body: Record<string, unknown> = { ...form, is_default: form.is_default };
          if (form.last_four) body.last_four = form.last_four;
          if (form.expiry_month) body.expiry_month = Number(form.expiry_month);
          if (form.expiry_year) body.expiry_year = Number(form.expiry_year);
          void request("POST", body);
        }}>
          <div className="sm:col-span-2"><label className="label">Provider token</label><input required className="input" placeholder={provider === "Stripe" ? "pm_..." : "tok_demo_4242"} value={form.provider_token} onChange={(e) => setForm({ ...form, provider_token: e.target.value })} /></div>
          <div><label className="label">Brand</label><input className="input" placeholder="Visa" value={form.card_brand} onChange={(e) => setForm({ ...form, card_brand: e.target.value })} /></div>
          <div><label className="label">Last four</label><input maxLength={4} className="input" placeholder="4242" value={form.last_four} onChange={(e) => setForm({ ...form, last_four: e.target.value })} /></div>
          <div><label className="label">Expiry month</label><input type="number" min={1} max={12} className="input" value={form.expiry_month} onChange={(e) => setForm({ ...form, expiry_month: e.target.value })} /></div>
          <div><label className="label">Expiry year</label><input type="number" min={2024} className="input" value={form.expiry_year} onChange={(e) => setForm({ ...form, expiry_year: e.target.value })} /></div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save card"}</button></div>
        </form>
      )}

      {methods.length === 0 ? <div className="card p-8 text-center muted">No saved payment methods yet.</div> : (
        <div className="space-y-3">
          {methods.map((method) => (
            <div key={method.payment_method_id} className="card flex items-center justify-between p-5">
              <div className="text-sm">
                <p className="font-semibold">{method.card_brand || "Card"} •••• {method.last_four || "----"} {method.is_default && <span className="badge ml-2 bg-brand-50 text-brand-700">Default</span>}</p>
                <p className="muted">{method.provider} · {method.type_name}{method.expiry_year ? ` · Expires ${method.expiry_month}/${method.expiry_year}` : ""}</p>
              </div>
              <div className="flex gap-3 text-sm">
                {!method.is_default && <button type="button" disabled={pending} className="link" onClick={() => void request("PATCH", { paymentMethodId: method.payment_method_id, is_default: true })}>Make default</button>}
                <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => void request("DELETE", { paymentMethodId: method.payment_method_id })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
