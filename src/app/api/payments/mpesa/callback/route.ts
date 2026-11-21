import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/checkout";
import { getPaymentSettings } from "@/lib/payment-config";
import { mpesaProvider, validMpesaCallbackSecret } from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const settings = await getPaymentSettings();
  const provided = new URL(request.url).searchParams.get("secret");
  if (!validMpesaCallbackSecret(settings.mpesa_callback_secret, provided)) {
    return NextResponse.json({ received: false, error: "invalid_secret" }, { status: 401 });
  }
  const raw = await request.text();
  const event = await mpesaProvider.verifyWebhook(raw, null);
  if (!event) return NextResponse.json({ received: false, error: "invalid_callback" }, { status: 400 });
  try {
    const applied = await settlePayment(event);
    // Always ack quickly; Daraja retries non-2xx responses.
    return NextResponse.json({ received: true, applied });
  } catch (error) {
    console.error("M-Pesa callback processing failed", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
