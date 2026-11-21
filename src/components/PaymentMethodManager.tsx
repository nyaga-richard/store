"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethodView } from "@/lib/types";
import { StripeCardEntry, type StripeCardHandle } from "./StripeCardEntry";

interface Config {
  provider: string;
  cardEnabled: boolean;
  stripePublishableKey: string;
  mpesaEnabled: boolean;
}

export function PaymentMethodManager({ methods, provider, config }: { methods: PaymentMethodView[]; provider: string; config: Config }) {
  const router = useRouter();
  const cardRef = useRef<StripeCardHandle>(null);
  const [showForm, setShowForm] = useState(methods.length === 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const isStripe = provider === "Stripe";

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
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function saveCard(event: React.FormEvent) {
    event.preventDefault();
    let cardDetails: { id: string; brand: string; last4: string; expMonth: number; expYear: number } | null = null;
    if (isStripe) {
      cardDetails = await cardRef.current?.tokenize() ?? null;
      if (!cardDetails) return;
    }
    await request("POST", {
      provider_token: isStripe ? cardDetails!.id : token,
      card_brand: cardDetails?.brand,
      last_four: cardDetails?.last4,
      expiry_month: cardDetails?.expMonth,
      expiry_year: cardDetails?.expYear,
      is_default: methods.length === 0,
    });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">Payment methods</h2>
        <button type="button" className="btn-secondary py-2" disabled={!config.cardEnabled} onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add card"}</button>
      </div>
      <div className="mb-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
        {isStripe
          ? "Card details are entered in Stripe's secure field. Only a provider token and the card's display details are saved."
          : "Demo mode: use tok_demo_4242. No real card is charged."}
        {config.mpesaEnabled && " M-Pesa numbers are entered at checkout when you choose M-Pesa."}
      </div>

      {showForm && config.cardEnabled && (
        <form className="card mb-6 max-w-xl space-y-4 p-5" onSubmit={saveCard}>
          {isStripe ? (
            <>
              <label className="label">Card details</label>
              <StripeCardEntry ref={cardRef} publishableKey={config.stripePublishableKey} />
              <p className="muted text-xs">Enter only your card number, expiry and CVC.</p>
            </>
          ) : (
            <div>
              <label className="label">Demo provider token</label>
              <input required className="input" placeholder="tok_demo_4242" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save card"}</button>
        </form>
      )}

      {methods.length === 0 ? <div className="card p-8 text-center muted">No saved payment methods yet.</div> : (
        <div className="space-y-3">
          {methods.map((method) => (
            <div key={method.payment_method_id} className="card flex items-center justify-between p-5">
              <div className="text-sm">
                <p className="font-semibold">
                  {method.type_name === "M-Pesa"
                    ? "M-Pesa"
                    : `${method.card_brand || "Card"} •••• ${method.last_four || "----"}`}
                  {method.is_default && <span className="badge ml-2 bg-brand-50 text-brand-700">Default</span>}
                </p>
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
