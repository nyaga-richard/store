"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Address, Country, PaymentMethodView, ShippingMethod } from "@/lib/types";

interface Props {
  addresses: Address[];
  paymentMethods: PaymentMethodView[];
  shippingMethods: ShippingMethod[];
  countries: Country[];
  cart: { lines: { product_name: string; quantity: number; unit_price_cents: number; discount_cents: number }[]; subtotal_cents: number; discount_cents: number; total_cents: number };
  userName: string;
  provider: string;
}

const steps = ["Shipping", "Delivery", "Payment"] as const;

export function CheckoutForm({ addresses, paymentMethods, shippingMethods, countries, cart, userName, provider }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.address_id ?? addresses[0]?.address_id ?? 0);
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);
  const [shippingId, setShippingId] = useState(shippingMethods[0]?.shipping_method_id ?? 0);
  const [paymentId, setPaymentId] = useState(paymentMethods.find((m) => m.is_default)?.payment_method_id ?? paymentMethods[0]?.payment_method_id ?? 0);
  const [useNewCard, setUseNewCard] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [newAddress, setNewAddress] = useState({
    address_line1: "", address_line2: "", city: "", region: "", postal_code: "",
    country_id: countries.find((c) => c.country_name === "Kenya")?.country_id ?? countries[0]?.country_id ?? 0,
    is_default: true,
  });
  const [newCard, setNewCard] = useState({ provider_token: "", card_brand: "", last_four: "", expiry_month: "", expiry_year: "" });

  const shipping = useMemo(() => shippingMethods.find((m) => m.shipping_method_id === shippingId), [shippingId, shippingMethods]);
  const total = cart.total_cents + (shipping?.price_cents ?? 0);

  function next() {
    if (step === 0 && !useNewAddress && !addressId) { setError("Choose or add a shipping address"); return; }
    if (step === 0 && useNewAddress && (!newAddress.address_line1 || !newAddress.city)) { setError("Fill in the required address fields"); return; }
    if (step === 1 && !shippingId) { setError("Choose a delivery method"); return; }
    setError("");
    setStep((current) => Math.min(2, current + 1));
  }

  async function pay() {
    setPending(true);
    setError("");
    try {
      let key = sessionStorage.getItem("ts_checkout_key");
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem("ts_checkout_key", key);
      }
      const body: Record<string, unknown> = {
        shipping_method_id: shippingId,
        idempotencyKey: key,
      };
      if (useNewAddress) body.newAddress = { ...newAddress, country_id: Number(newAddress.country_id), is_default: newAddress.is_default };
      else body.addressId = Number(addressId);
      if (useNewCard) {
        body.newPaymentToken = newCard.provider_token.trim();
        if (newCard.card_brand) body.cardBrand = newCard.card_brand;
        if (/^\d{4}$/.test(newCard.last_four)) body.lastFour = newCard.last_four;
        if (newCard.expiry_month) body.expiryMonth = Number(newCard.expiry_month);
        if (newCard.expiry_year) body.expiryYear = Number(newCard.expiry_year);
      } else body.paymentMethodId = Number(paymentId);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Checkout failed");
      sessionStorage.removeItem("ts_checkout_key");
      router.push(`/account/orders/${payload.data.orderId}?new=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <ol className="mb-6 flex items-center gap-2 text-sm">
          {steps.map((name, index) => (
            <li key={name} className="flex items-center gap-2">
              <button type="button" onClick={() => index < step && setStep(index)} disabled={index > step}
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index === step ? "bg-brand-700 text-white" : index < step ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                {index < step ? "✓" : index + 1}
              </button>
              <span className={index === step ? "font-semibold" : "text-slate-500"}>{name}</span>
              {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300 sm:w-10" />}
            </li>
          ))}
        </ol>

        <div className="card p-6">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-bold">Shipping address</h2>
              <p className="muted mb-4">Delivering to {userName}</p>
              {addresses.length > 0 && (
                <div className="space-y-2">
                  {addresses.map((address) => (
                    <label key={address.address_id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${!useNewAddress && addressId === address.address_id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                      <input type="radio" name="address" checked={!useNewAddress && addressId === address.address_id}
                        onChange={() => { setAddressId(address.address_id); setUseNewAddress(false); }} className="mt-1 accent-brand-700" />
                      <span className="text-sm">
                        <strong>{address.address_line1}</strong>
                        {address.address_line2 && <span className="block text-slate-500">{address.address_line2}</span>}
                        <span className="block text-slate-500">{address.city}{address.region ? `, ${address.region}` : ""} {address.postal_code}</span>
                        <span className="block text-slate-500">{address.country_name}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={useNewAddress} onChange={(event) => setUseNewAddress(event.target.checked)} className="accent-brand-700" />
                Use a new address
              </label>
              {useNewAddress && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="label">Address line 1</label><input className="input" value={newAddress.address_line1} onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })} /></div>
                  <div className="sm:col-span-2"><label className="label">Address line 2 (optional)</label><input className="input" value={newAddress.address_line2} onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })} /></div>
                  <div><label className="label">City</label><input className="input" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} /></div>
                  <div><label className="label">Region / County</label><input className="input" value={newAddress.region} onChange={(e) => setNewAddress({ ...newAddress, region: e.target.value })} /></div>
                  <div><label className="label">Postal code</label><input className="input" value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} /></div>
                  <div><label className="label">Country</label><select className="input" value={newAddress.country_id} onChange={(e) => setNewAddress({ ...newAddress, country_id: Number(e.target.value) })}>
                    {countries.map((country) => <option key={country.country_id} value={country.country_id}>{country.country_name}</option>)}
                  </select></div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={newAddress.is_default} onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })} className="accent-brand-700" /> Save as default address</label>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold">Delivery method</h2>
              <p className="muted mb-4">Shipping cost is copied onto your order at checkout.</p>
              <div className="space-y-2">
                {shippingMethods.map((method) => (
                  <label key={method.shipping_method_id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${shippingId === method.shipping_method_id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <input type="radio" name="shipping" checked={shippingId === method.shipping_method_id} onChange={() => setShippingId(method.shipping_method_id)} className="accent-brand-700" />
                      {method.method_name}
                    </span>
                    <span className="font-semibold">{formatMoney(method.price_cents)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold">Payment method</h2>
              <p className="muted mb-4">Provider: {provider}. Only provider tokens are stored — never card numbers.</p>
              {paymentMethods.length > 0 && (
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <label key={method.payment_method_id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${!useNewCard && paymentId === method.payment_method_id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                      <span className="flex items-center gap-3 text-sm font-medium">
                        <input type="radio" name="payment" checked={!useNewCard && paymentId === method.payment_method_id}
                          onChange={() => { setPaymentId(method.payment_method_id); setUseNewCard(false); }} className="accent-brand-700" />
                        {method.card_brand || "Card"} •••• {method.last_four || "----"}
                      </span>
                      {method.is_default && <span className="badge bg-white text-slate-500">Default</span>}
                    </label>
                  ))}
                </div>
              )}
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={useNewCard} onChange={(event) => setUseNewCard(event.target.checked)} className="accent-brand-700" />
                Add a new tokenised card
              </label>
              {useNewCard && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Payment provider token</label>
                    <input className="input" placeholder={provider === "Stripe" ? "pm_..." : "tok_demo_4242"} value={newCard.provider_token}
                      onChange={(e) => setNewCard({ ...newCard, provider_token: e.target.value })} />
                    <p className="muted mt-1">In demo mode use <code>tok_demo_4242</code>. With Stripe, use a token generated by Stripe.js.</p>
                  </div>
                  <div><label className="label">Card brand</label><input className="input" placeholder="Visa" value={newCard.card_brand} onChange={(e) => setNewCard({ ...newCard, card_brand: e.target.value })} /></div>
                  <div><label className="label">Last four digits</label><input className="input" maxLength={4} placeholder="4242" value={newCard.last_four} onChange={(e) => setNewCard({ ...newCard, last_four: e.target.value })} /></div>
                  <div><label className="label">Expiry month</label><input className="input" type="number" min={1} max={12} value={newCard.expiry_month} onChange={(e) => setNewCard({ ...newCard, expiry_month: e.target.value })} /></div>
                  <div><label className="label">Expiry year</label><input className="input" type="number" min={2024} value={newCard.expiry_year} onChange={(e) => setNewCard({ ...newCard, expiry_year: e.target.value })} /></div>
                </div>
              )}
              <p className="muted mt-4">🔒 Payments are idempotent: retrying this step cannot charge you twice.</p>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex justify-between">
            {step > 0 ? <button type="button" className="btn-secondary" onClick={() => { setError(""); setStep(step - 1); }}>← Back</button> : <Link href="/cart" className="btn-secondary">← Cart</Link>}
            {step < 2
              ? <button type="button" className="btn-primary" onClick={next}>Continue →</button>
              : <button type="button" className="btn-primary" disabled={pending || total <= 0} onClick={pay}>{pending ? "Processing payment..." : `Pay ${formatMoney(total)}`}</button>}
          </div>
        </div>
      </div>

      <aside className="card h-fit p-6">
        <h2 className="text-lg font-bold">Order summary</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {cart.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="text-slate-600">{line.quantity} × {line.product_name}</span>
              <span className="shrink-0 font-medium">{formatMoney((line.unit_price_cents - line.discount_cents) * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(cart.subtotal_cents + cart.discount_cents)}</dd></div>
          <div className="flex justify-between text-brand-700"><dt>Promotions</dt><dd>−{formatMoney(cart.discount_cents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd>{shipping ? formatMoney(shipping.price_cents) : "—"}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><dt>Total</dt><dd>{formatMoney(total)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}
