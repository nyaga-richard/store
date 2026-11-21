import { getBackofficeUser } from "@/lib/admin";
import { appUrl } from "@/lib/env";
import { getPaymentSettings, maskSecret, SECRET_KEYS } from "@/lib/payment-config";
import { PaymentSettingsForm } from "@/components/PaymentSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment settings" };

export default async function AdminPaymentsPage() {
  const [settings, user] = await Promise.all([getPaymentSettings(), getBackofficeUser()]);
  const canEdit = user?.role === "owner" || user?.role === "admin";
  // Never serialise raw gateway secrets into the browser/RSC payload.
  const masked = {
    ...settings,
    ...Object.fromEntries(SECRET_KEYS.map((key) => [key, maskSecret(settings[key])])),
  };
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Payment settings</h2>
        <p className="muted">Configure Stripe card checkout and M-Pesa STK push. Credentials stay on the server.</p>
      </div>
      <PaymentSettingsForm values={masked} canEdit={canEdit}
        callbackUrl={`${appUrl()}/api/payments/mpesa/callback`} />
    </div>
  );
}
