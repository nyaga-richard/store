export type PaymentStatus = "Succeeded" | "Pending" | "Failed" | "Refunded";

export interface ChargeRequest {
  orderId: number;
  amountCents: number;
  currency: "kes";
  paymentToken: string;
  idempotencyKey: string;
  description: string;
  customerEmail?: string;
}

export interface ChargeResult {
  reference: string;
  status: PaymentStatus;
  provider: string;
  message?: string;
}

export interface ProviderWebhookEvent {
  type: "payment.succeeded" | "payment.failed" | "payment.refunded";
  reference: string;
  orderId?: number;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  verifyWebhook(rawBody: string, signature: string | null): ProviderWebhookEvent | null;
}
