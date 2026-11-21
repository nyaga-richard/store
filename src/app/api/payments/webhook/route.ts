import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/checkout";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const provider = getPaymentProvider();
  const signature = provider.name === "Stripe"
    ? request.headers.get("stripe-signature")
    : request.headers.get("x-webhook-signature");
  const event = provider.verifyWebhook(raw, signature);
  if (!event) return NextResponse.json({ received: false, error: "invalid_signature" }, { status: 400 });

  try {
    const applied = await settlePayment(event);
    return NextResponse.json({ received: true, applied });
  } catch (error) {
    console.error("Webhook processing failed", error);
    // Return 500 so the provider retries with backoff.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
