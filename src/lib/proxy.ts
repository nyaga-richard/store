import "server-only";
import { headers } from "next/headers";
import { appUrl } from "./env";

/** Origin as seen through Cloudflare Tunnel (X-Forwarded-Proto/Host). */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
  const host = headerList.get("x-forwarded-host")?.split(",")[0].trim()
    || headerList.get("host")
    || new URL(appUrl()).host;
  return `${proto}://${host}`;
}
