import Stripe from "stripe";
import { requiredEnv } from "../env";
import type { ChargeRequest, ChargeResult, PaymentProvider, ProviderWebhookEvent } from "./types";

let client: Stripe | null = null;
function stripe(): Stripe {
  if (!client) client = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), { apiVersion: "2025-08-27.basil" });
  return client;
}

/**
 * Stripe uses payment method tokens (pm_...) only — raw card numbers never
 * enter our database or application code. Idempotency keys are forwarded on
 * every charge so retries cannot double-capture funds.
 */
export const stripeProvider: PaymentProvider = {
  name: "Stripe",

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    try {
      const intent = await stripe().paymentIntents.create(
        {
          amount: request.amountCents,
          currency: request.currency,
          payment_method: request.paymentToken,
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
        message: intent.status === "requires_action" ? "Payment requires additional authentication" : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      return { reference: `failed_${request.idempotencyKey}`, status: "Failed", provider: "Stripe", message };
    }
  },

  verifyWebhook(rawBody: string, signature: string | null): ProviderWebhookEvent | null {
    if (!signature) return null;
    try {
      const event = stripe().webhooks.constructEvent(rawBody, signature, requiredEnv("STRIPE_WEBHOOK_SECRET"));
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
