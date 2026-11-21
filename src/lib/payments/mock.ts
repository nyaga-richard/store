import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "../env";
import type { ChargeRequest, ChargeResult, PaymentProvider, ProviderWebhookEvent } from "./types";

/**
 * Deterministic development provider. It never handles card data and can be
 * driven by signed webhooks exactly like the Stripe provider.
 */
export const mockProvider: PaymentProvider = {
  name: "Mock",

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amountCents <= 0) return { reference: `mock_${request.idempotencyKey}`, status: "Failed", provider: "Mock", message: "Invalid amount" };
    return {
      reference: `mock_${request.idempotencyKey}`,
      status: "Succeeded",
      provider: "Mock",
      message: "Demo payment approved",
    };
  },

  verifyWebhook(rawBody: string, signature: string | null): ProviderWebhookEvent | null {
    if (!signature) return null;
    const expected = createHmac("sha256", requiredEnv("SESSION_SECRET")).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const parsed = JSON.parse(rawBody) as ProviderWebhookEvent;
      if (!["payment.succeeded", "payment.failed", "payment.refunded"].includes(parsed.type) || !parsed.reference) return null;
      return parsed;
    } catch {
      return null;
    }
  },
};
