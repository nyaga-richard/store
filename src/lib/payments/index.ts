import "server-only";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "stripe" ? stripeProvider : mockProvider;
}

export type { PaymentStatus } from "./types";
