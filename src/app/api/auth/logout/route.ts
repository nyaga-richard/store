import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/api";
import { clearGuestCart } from "@/lib/cart-cookie";
import { clearStaffSession } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  await clearStaffSession();
  await clearGuestCart();
  return ok({ loggedOut: true });
}
