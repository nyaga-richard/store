"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";

export interface TokenisedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface StripeCardHandle {
  tokenize: () => Promise<TokenisedCard | null>;
}

interface Props {
  publishableKey: string;
  name?: string;
  email?: string;
  disabled?: boolean;
}

/**
 * Stripe's own hosted card field. The browser sends card details straight to
 * Stripe and we receive only a pm_... payment method token.
 */
export const StripeCardEntry = forwardRef<StripeCardHandle, Props>(function StripeCardEntry(
  { publishableKey, name, email, disabled }, ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let card: StripeCardElement | null = null;
    loadStripe(publishableKey).then((stripe) => {
      if (cancelled || !stripe || !mountRef.current) return;
      stripeRef.current = stripe;
      card = stripe.elements().create("card", {
        style: {
          base: { fontSize: "15px", color: "#0f172a", "::placeholder": { color: "#94a3b8" } },
          invalid: { color: "#dc2626" },
        },
      });
      card.mount(mountRef.current);
      cardRef.current = card;
      setReady(true);
    }).catch(() => setError("Could not load Stripe. Check your connection and publishable key."));
    return () => {
      cancelled = true;
      card?.destroy();
      cardRef.current = null;
      stripeRef.current = null;
    };
  }, [publishableKey]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      const stripe = stripeRef.current;
      const card = cardRef.current;
      if (!stripe || !card) return null;
      setError("");
      const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
        type: "card",
        card,
        billing_details: { name, email },
      });
      if (stripeError || !paymentMethod) {
        setError(stripeError?.message || "Could not validate card details");
        return null;
      }
      const details = paymentMethod.card;
      return {
        id: paymentMethod.id,
        brand: details?.brand || "Card",
        last4: details?.last4 || "----",
        expMonth: details?.exp_month || 0,
        expYear: details?.exp_year || 0,
      };
    },
  }), [name, email]);

  return (
    <div>
      <div ref={mountRef} className="rounded-xl border border-slate-300 bg-white px-3 py-3" aria-disabled={disabled} />
      {!ready && !error && <p className="muted mt-1 text-xs">Loading secure card field…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
