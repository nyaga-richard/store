import { fail, ok } from "@/lib/api";
import { getPaymentSettings, publicPaymentConfig } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(publicPaymentConfig(await getPaymentSettings()));
  } catch (error) {
    return fail(error);
  }
}
