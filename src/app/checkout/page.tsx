import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { query } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { getPaymentSettings, publicPaymentConfig } from "@/lib/payment-config";
import type { Address, Country, PaymentMethodView, ShippingMethod } from "@/lib/types";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const [addresses, paymentMethods, shippingMethods, countries, cart, provider, settings] = await Promise.all([
    query<Address>(
      `SELECT a.address_id, a.address_line1, a.address_line2, a.city, a.region, a.postal_code,
              a.country_id, co.country_name, a.is_default
       FROM address a JOIN country co ON co.country_id = a.country_id
       WHERE a.customer_id = $1 ORDER BY a.is_default DESC, a.address_id`, [user.customer_id]),
    query<PaymentMethodView>(
      `SELECT pm.payment_method_id, pm.provider, pm.card_brand, pm.last_four, pm.expiry_month,
              pm.expiry_year, pm.is_default, pt.type_name
       FROM payment_method pm JOIN payment_type pt ON pt.payment_type_id = pm.payment_type_id
       WHERE pm.customer_id = $1 ORDER BY pm.is_default DESC, pm.payment_method_id`, [user.customer_id]),
    query<ShippingMethod>(
      `SELECT shipping_method_id, method_name, (price * 100)::bigint::text AS price_cents
       FROM shipping_method ORDER BY shipping_method_id`),
    query<Country>(`SELECT country_id, country_name FROM country ORDER BY country_name`),
    getCart(user),
    getPaymentProvider(),
    getPaymentSettings(),
  ]);

  if (cart.lines.length === 0) redirect("/cart");

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="section-title">Checkout</h1>
        <p className="muted mt-1">A few details and your order is on its way.</p>
      </div>
      <CheckoutForm
        addresses={addresses}
        paymentMethods={paymentMethods}
        shippingMethods={shippingMethods.map((method) => ({ ...method, price_cents: Number(method.price_cents) }))}
        countries={countries}
        cart={cart}
        userName={`${user.first_name} ${user.last_name}`}
        provider={provider.name}
        paymentConfig={publicPaymentConfig(settings)}
      />
    </div>
  );
}
