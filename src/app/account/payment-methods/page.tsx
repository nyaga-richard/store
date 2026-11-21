import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { getPaymentSettings, publicPaymentConfig } from "@/lib/payment-config";
import type { PaymentMethodView } from "@/lib/types";
import { PaymentMethodManager } from "@/components/PaymentMethodManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment methods" };

export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const methods = await query<PaymentMethodView>(
    `SELECT pm.payment_method_id, pm.provider, pm.card_brand, pm.last_four, pm.expiry_month,
            pm.expiry_year, pm.is_default, pt.type_name
     FROM payment_method pm JOIN payment_type pt ON pt.payment_type_id = pm.payment_type_id
     WHERE pm.customer_id = $1 ORDER BY pm.is_default DESC, pm.payment_method_id`, [user.customer_id]);
  const [provider, settings] = await Promise.all([getPaymentProvider(), getPaymentSettings()]);
  return <PaymentMethodManager methods={methods} provider={provider.name} config={publicPaymentConfig(settings)} />;
}
