"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Address, Country, PaymentMethodView, ShippingMethod } from "@/lib/types";
import { StripeCardEntry, type StripeCardHandle } from "./StripeCardEntry";

interface Props {
  addresses: Address[];
  paymentMethods: PaymentMethodView[];
  shippingMethods: ShippingMethod[];
  countries: Country[];
  cart: { lines: { product_name: string; quantity: number; unit_price_cents: number; discount_cents: number }[]; subtotal_cents: number; discount_cents: number; total_cents: number };
  userName: string;
  provider: string;
  paymentConfig: { provider: string; cardEnabled: boolean; stripePublishableKey: string; mpesaEnabled: boolean };
}

const steps = ["Shipping", "Delivery", "Payment"] as const;

export function CheckoutForm({ addresses, paymentMethods, shippingMethods, countries, cart, userName, provider, paymentConfig }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.address_id ?? addresses[0]?.address_id ?? 0);
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);
  const [shippingId, setShippingId] = useState(shippingMethods[0]?.shipping_method_id ?? 0);
  const [paymentId, setPaymentId] = useState(paymentMethods.find((m) => m.is_default)?.payment_method_id ?? paymentMethods[0]?.payment_method_id ?? 0);
  const [useNewCard, setUseNewCard] = useState(false);
  const [gateway, setGateway] = useState<"card" | "mpesa">(paymentConfig.mpesaEnabled && !paymentConfig.cardEnabled ? "mpesa" : "card");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const cardRef = useRef<StripeCardHandle>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [newAddress, setNewAddress] = useState({
    address_line1: "", address_line2: "", city: "", region: "", postal_code: "",
    country_id: countries.find((c) => c.country_name === "Kenya")?.country_id ?? countries[0]?.country_id ?? 0,
    is_default: true,
  });
  const [newCard, setNewCard] = useState({ provider_token: "" });

  const shipping = useMemo(() => shippingMethods.find((m) => m.shipping_method_id === shippingId), [shippingId, shippingMethods]);
  const total = cart.total_cents + (shipping?.price_cents ?? 0);

  function next() {
    if (step === 0 && !useNewAddress && !addressId) { setError("Choose or add a shipping address"); return; }
    if (step === 0 && useNewAddress && (!newAddress.address_line1 || !newAddress.city)) { setError("Fill in the required address fields"); return; }
    if (step === 1 && !shippingId) { setError("Choose a delivery method"); return; }
    if (step === 2 && gateway === "mpesa" && !/^(?:\+?254|0)?7\d{8}$/.test(mpesaPhone.trim())) {
      setError("Enter a valid M-Pesa phone number"); return;
    }
    if (step === 2 && gateway === "card" && !useNewCard && !paymentId) { setError("Choose a card or add a new one"); return; }
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
      if (gateway === "mpesa") {
        body.gateway = "mpesa";
        body.mpesaPhone = mpesaPhone.trim();
      } else {
        body.gateway = "card";
        if (useNewCard) {
          if (provider === "Stripe") {
            const card = await cardRef.current?.tokenize();
            if (!card) throw new Error("Enter your card details in the secure Stripe field");
            body.newPaymentToken = card.id;
            body.cardBrand = card.brand;
            body.lastFour = card.last4;
            body.expiryMonth = card.expMonth;
            body.expiryYear = card.expYear;
          } else {
            body.newPaymentToken = newCard.provider_token.trim();
          }
        } else body.paymentMethodId = Number(paymentId);
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Checkout failed");
      sessionStorage.removeItem("ts_checkout_key");
      router.push(`/account/orders/${payload.data.orderId}?new=1${gateway === "mpesa" ? "&gateway=mpesa" : ""}`);
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
              <p className="muted mb-4">Only provider tokens are stored — never card numbers.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${gateway === "card" ? "border-brand-600 bg-brand-50" : "border-slate-200"} ${!paymentConfig.cardEnabled ? "opacity-50" : ""}`}>
                  <input type="radio" name="gateway" checked={gateway === "card"} disabled={!paymentConfig.cardEnabled}
                    onChange={() => setGateway("card")} className="mt-1 accent-brand-700" />
                  <span className="text-sm"><strong>Card</strong><span className="muted block">{paymentConfig.provider === "Stripe" ? "Secure Stripe card field" : "Demo card token"}</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${gateway === "mpesa" ? "border-brand-600 bg-brand-50" : "border-slate-200"} ${!paymentConfig.mpesaEnabled ? "opacity-50" : ""}`}>
                  <input type="radio" name="gateway" checked={gateway === "mpesa"} disabled={!paymentConfig.mpesaEnabled}
                    onChange={() => setGateway("mpesa")} className="mt-1 accent-brand-700" />
                  <span className="text-sm"><strong>M-Pesa</strong><span className="muted block">STK push to your phone</span></span>
                </label>
              </div>

              {gateway === "card" && (
                <div className="mt-5">
                  {paymentMethods.filter((method) => method.type_name === "Card").length > 0 && (
                    <div className="space-y-2">
                      {paymentMethods.filter((method) => method.type_name === "Card").map((method) => (
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
                    Add a new card
                  </label>
                  {useNewCard && (
                    <div className="mt-3 rounded-xl border border-slate-200 p-4">
                      {provider === "Stripe" ? (
                        <>
                          <StripeCardEntry ref={cardRef} publishableKey={paymentConfig.stripePublishableKey} name={userName} />
                          <p className="muted mt-2 text-xs">Enter only your card number, expiry and CVC. Stripe handles them directly.</p>
                        </>
                      ) : (
                        <>
                          <label className="label">Demo provider token</label>
                          <input className="input" placeholder="tok_demo_4242" value={newCard.provider_token}
                            onChange={(e) => setNewCard({ ...newCard, provider_token: e.target.value })} />
                          <p className="muted mt-1">Demo mode only — no real card is charged.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {gateway === "mpesa" && (
                <div className="mt-5">
                  <label className="label" htmlFor="mpesa-phone">M-Pesa phone number</label>
                  <input id="mpesa-phone" className="input" inputMode="tel" placeholder="0712345678" value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)} />
                  <p className="muted mt-2 text-sm">You&apos;ll receive an STK push on this number. Enter your M-Pesa PIN on your phone to complete payment.</p>
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
