import "server-only";
import { cache } from "react";
import { query } from "./db";

export const DEFAULT_SETTINGS = {
  site_name: "Trusted Systems Store",
  announcement: "Free delivery on orders over KES 20,000 · Nairobi next-day delivery · Secure checkout",
  hero_title: "Good tech.\nFair prices.\nFast delivery.",
  hero_subtitle: "Discover headphones, smartwatches, keyboards and home essentials from Trusted Systems. Transparent pricing, real stock, and payments you can trust.",
  support_email: "hello@trustedsystems.co.ke",
  support_phone: "+254700000000",
  support_hours: "Mon–Sat, 8am–6pm",
  support_address: "Nairobi, Kenya",
  footer_note: "Quality everyday tech and home goods, delivered across Kenya with secure payments and local support.",
  free_shipping_threshold: "20000",
} as const;

export type SiteSettings = { [K in keyof typeof DEFAULT_SETTINGS]: string };

/** Deduplicated per request; falls back to defaults if settings are not seeded yet. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM site_setting`);
    return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value])) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});
