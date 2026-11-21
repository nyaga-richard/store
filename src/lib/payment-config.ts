import "server-only";
import { cache } from "react";
import { query } from "./db";

export const PAYMENT_SETTING_KEYS = [
  "card_provider",
  "stripe_enabled",
  "stripe_publishable_key",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "mpesa_enabled",
  "mpesa_consumer_key",
  "mpesa_consumer_secret",
  "mpesa_shortcode",
  "mpesa_passkey",
  "mpesa_environment",
  "mpesa_callback_secret",
] as const;

export type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number];
export type PaymentSettings = Record<PaymentSettingKey, string>;
export type SecretKey = Extract<PaymentSettingKey,
  "stripe_secret_key" | "stripe_webhook_secret" | "mpesa_consumer_secret" | "mpesa_passkey" | "mpesa_callback_secret">;

export const SECRET_KEYS: SecretKey[] = [
  "stripe_secret_key", "stripe_webhook_secret", "mpesa_consumer_secret", "mpesa_passkey", "mpesa_callback_secret",
];

/** Env values are used only until an admin saves a value in /admin/payments. */
export function defaultPaymentSettings(): PaymentSettings {
  return {
    card_provider: process.env.PAYMENT_PROVIDER === "stripe" || process.env.STRIPE_SECRET_KEY ? "stripe" : "mock",
    stripe_enabled: process.env.PAYMENT_PROVIDER === "stripe" || process.env.STRIPE_SECRET_KEY ? "true" : "false",
    stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || "",
    stripe_secret_key: process.env.STRIPE_SECRET_KEY || "",
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
    mpesa_enabled: "false",
    mpesa_consumer_key: process.env.MPESA_CONSUMER_KEY || "",
    mpesa_consumer_secret: process.env.MPESA_CONSUMER_SECRET || "",
    mpesa_shortcode: process.env.MPESA_SHORTCODE || "",
    mpesa_passkey: process.env.MPESA_PASSKEY || "",
    mpesa_environment: process.env.MPESA_ENVIRONMENT || "sandbox",
    mpesa_callback_secret: process.env.MPESA_CALLBACK_SECRET || "",
  };
}

/** Deduplicated per request; never call this from code that runs in the browser. */
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM payment_gateway_setting`);
    return { ...defaultPaymentSettings(), ...Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value])) };
  } catch {
    return defaultPaymentSettings();
  }
});

export function maskSecret(value: string): string {
  if (!value) return "";
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

/** Values hidden from the browser; only flags and the Stripe publishable key are public. */
export function publicPaymentConfig(settings: PaymentSettings) {
  const cardEnabled = settings.card_provider === "stripe"
    ? settings.stripe_enabled === "true" && Boolean(settings.stripe_publishable_key && settings.stripe_secret_key)
    : true; // the signed mock provider is always available for demos
  return {
    provider: settings.card_provider === "stripe" ? "Stripe" : "Mock",
    cardEnabled,
    stripePublishableKey: settings.card_provider === "stripe" && cardEnabled ? settings.stripe_publishable_key : "",
    mpesaEnabled: settings.mpesa_enabled === "true",
  };
}
