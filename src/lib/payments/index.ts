import "server-only";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import { mpesaProvider } from "./mpesa";
import { getPaymentSettings } from "../payment-config";
import type { Gateway, PaymentProvider } from "./types";

/** Card payments default to Stripe; M-Pesa uses Safaricom Daraja STK push. */
export async function getPaymentProvider(gateway: Gateway = "card"): Promise<PaymentProvider> {
  if (gateway === "mpesa") return mpesaProvider;
  const settings = await getPaymentSettings();
  return settings.card_provider === "stripe" ? stripeProvider : mockProvider;
}

export type { Gateway } from "./types";
export type { PaymentStatus } from "./types";
