import Stripe from "stripe";
import { getPaymentSettings } from "../payment-config";
import type { ChargeRequest, ChargeResult, PaymentProvider, ProviderWebhookEvent } from "./types";

/** A fresh client is cheap and picks up keys changed in /admin/payments. */
async function stripe(): Promise<Stripe> {
  const settings = await getPaymentSettings();
  return new Stripe(settings.stripe_secret_key, { apiVersion: "2025-08-27.basil" });
}

/**
 * Stripe receives only payment-method tokens (pm_...) created by Stripe.js in
 * the browser. Raw card numbers never enter this application. Idempotency keys
 * are forwarded on every charge so retries cannot double-capture funds.
 */
export const stripeProvider: PaymentProvider = {
  name: "Stripe",

  async isConfigured(): Promise<boolean> {
    const settings = await getPaymentSettings();
    return settings.stripe_enabled === "true" && Boolean(settings.stripe_secret_key && settings.stripe_publishable_key);
  },

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    try {
      const intent = await (await stripe()).paymentIntents.create(
        {
          amount: request.amountCents,
          currency: request.currency,
          payment_method: request.paymentToken,
          payment_method_types: ["card"],
          confirm: true,
          off_session: true,
          description: request.description,
          receipt_email: request.customerEmail,
          metadata: {
            order_id: String(request.orderId),
            idempotency_key: request.idempotencyKey,
          },
        },
        { idempotencyKey: `order_${request.orderId}_${request.idempotencyKey}` },
      );
      return {
        reference: intent.id,
        status: intent.status === "succeeded" ? "Succeeded" : "Pending",
        provider: "Stripe",
        message: intent.status === "requires_action" ? "Your bank needs additional authentication" : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      return { reference: `failed_${request.idempotencyKey}`, status: "Failed", provider: "Stripe", message };
    }
  },

  async verifyWebhook(rawBody: string, signature: string | null): Promise<ProviderWebhookEvent | null> {
    if (!signature) return null;
    try {
      const settings = await getPaymentSettings();
      const event = (await stripe()).webhooks.constructEvent(rawBody, signature, settings.stripe_webhook_secret);
      if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object as Stripe.PaymentIntent;
        return { type: "payment.succeeded", reference: intent.id, orderId: Number(intent.metadata.order_id) || undefined };
      }
      if (event.type === "payment_intent.payment_failed") {
        const intent = event.data.object as Stripe.PaymentIntent;
        return { type: "payment.failed", reference: intent.id, orderId: Number(intent.metadata.order_id) || undefined, message: intent.last_payment_error?.message };
      }
      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        return { type: "payment.refunded", reference: String(charge.payment_intent), orderId: Number(charge.metadata?.order_id) || undefined };
      }
      return null;
    } catch {
      return null;
    }
  },
};
