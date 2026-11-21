import { timingSafeEqual } from "node:crypto";
import { appUrl } from "../env";
import { getPaymentSettings } from "../payment-config";
import type { ChargeRequest, ChargeResult, PaymentProvider, ProviderWebhookEvent } from "./types";

interface TokenCache { token: string; expiresAt: number }
const tokenCache = new Map<string, TokenCache>();

/** Accepts 0712345678, +254712345678 or 254712345678 and returns 254712345678. */
export function normaliseMpesaPhone(phone: string): string | null {
  const match = phone.trim().replace(/[\s-]/g, "").match(/^(?:\+?254|0)?(7\d{8})$/);
  return match ? `254${match[1]}` : null;
}

function nairobiTimestamp(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}${value("month")}${value("day")}${value("hour")}${value("minute")}${value("second")}`;
}

async function accessToken(baseUrl: string, consumerKey: string, consumerSecret: string): Promise<string> {
  const cacheKey = `${baseUrl}:${consumerKey}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`M-Pesa authentication failed (${response.status})`);
  const body = (await response.json()) as { access_token?: string; expires_in?: string };
  if (!body.access_token) throw new Error("M-Pesa authentication returned no token");
  tokenCache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) - 60) * 1000 });
  return body.access_token;
}

interface StkCallback {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name?: string; Value?: unknown }[] };
    };
  };
}

/** Safaricom Daraja STK push. No card or bank details are handled here. */
export const mpesaProvider: PaymentProvider = {
  name: "M-Pesa",

  async isConfigured(): Promise<boolean> {
    const settings = await getPaymentSettings();
    return settings.mpesa_enabled === "true" && Boolean(
      settings.mpesa_consumer_key && settings.mpesa_consumer_secret && settings.mpesa_shortcode && settings.mpesa_passkey,
    );
  },

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    try {
      const settings = await getPaymentSettings();
      const phone = normaliseMpesaPhone(request.paymentToken);
      if (!phone) throw new Error("Enter a valid M-Pesa phone number");
      // Daraja bills whole shillings; checkout rejects cents for this gateway.
      if (request.amountCents % 100 !== 0) throw new Error("M-Pesa amounts must be whole shillings");
      const baseUrl = settings.mpesa_environment === "production"
        ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
      const token = await accessToken(baseUrl, settings.mpesa_consumer_key, settings.mpesa_consumer_secret);
      const timestamp = nairobiTimestamp();
      const password = Buffer.from(`${settings.mpesa_shortcode}${settings.mpesa_passkey}${timestamp}`).toString("base64");
      const callbackUrl = `${appUrl()}/api/payments/mpesa/callback`
        + (settings.mpesa_callback_secret ? `?secret=${encodeURIComponent(settings.mpesa_callback_secret)}` : "");

      const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: settings.mpesa_shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: request.amountCents / 100,
          PartyA: phone,
          PartyB: settings.mpesa_shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: `ORD${request.orderId}`,
          TransactionDesc: request.description.slice(0, 50),
        }),
        cache: "no-store",
      });
      const body = (await response.json()) as {
        ResponseCode?: string; CheckoutRequestID?: string; ResponseDescription?: string; errorCode?: string; errorMessage?: string;
      };
      if (!response.ok || (body.ResponseCode && body.ResponseCode !== "0") || !body.CheckoutRequestID) {
        throw new Error(body.ResponseDescription || body.errorMessage || `M-Pesa request failed (${response.status})`);
      }
      return {
        reference: body.CheckoutRequestID,
        status: "Pending",
        provider: "M-Pesa",
        message: "Check your phone for the M-Pesa prompt and enter your PIN to complete payment.",
      };
    } catch (error) {
      return {
        reference: `mpesa_failed_${request.idempotencyKey}`,
        status: "Failed",
        provider: "M-Pesa",
        message: error instanceof Error ? error.message : "M-Pesa payment failed",
      };
    }
  },

  async verifyWebhook(rawBody: string, signature: string | null): Promise<ProviderWebhookEvent | null> {
    // The callback route validates the shared secret in the URL query string.
    void signature;
    try {
      const parsed = JSON.parse(rawBody) as StkCallback;
      const callback = parsed.Body?.stkCallback;
      if (!callback?.CheckoutRequestID || typeof callback.ResultCode !== "number") return null;
      const items = callback.CallbackMetadata?.Item ?? [];
      const reference = items.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
      const account = items.find((item) => item.Name === "AccountReference")?.Value;
      const orderId = typeof account === "string" ? Number(account.replace(/^ORD/i, "")) : NaN;
      return {
        type: callback.ResultCode === 0 ? "payment.succeeded" : "payment.failed",
        reference: callback.CheckoutRequestID,
        orderId: Number.isInteger(orderId) && orderId > 0 ? orderId : undefined,
        message: callback.ResultDesc,
      };
    } catch {
      return null;
    }
  },
};

/** Constant-time check for the secret appended to the Daraja callback URL. */
export function validMpesaCallbackSecret(expected: string, provided: string | null): boolean {
  if (!expected) return true; // legacy callbacks without a configured secret
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
