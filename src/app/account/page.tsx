import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const user = await requireUser();
  const stats = await queryOne<{ orders: number; spent_cents: number; addresses: number; methods: number }>(
    `SELECT (SELECT COUNT(*)::int FROM customer_order WHERE customer_id = $1 AND order_status_id <> 1) AS orders,
            (SELECT COALESCE(SUM(order_total), 0) FROM customer_order WHERE customer_id = $1 AND order_status_id IN (2,3,4,5)) AS spent_cents,
            (SELECT COUNT(*)::int FROM address WHERE customer_id = $1) AS addresses,
            (SELECT COUNT(*)::int FROM payment_method WHERE customer_id = $1) AS methods`,
    [user.customer_id],
  );

  const cards = [
    { label: "Orders placed", value: String(stats?.orders ?? 0), href: "/account/orders" },
    { label: "Lifetime spend", value: formatMoney(Math.round(Number(stats?.spent_cents ?? 0) * 100)), href: "/account/orders" },
    { label: "Saved addresses", value: String(stats?.addresses ?? 0), href: "/account/addresses" },
    { label: "Payment methods", value: String(stats?.methods ?? 0), href: "/account/payment-methods" },
  ];

  return (
    <div>
      <p className="muted">Welcome back, {user.first_name}. Here is a quick look at your account.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-5 transition hover:border-brand-600">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </Link>
        ))}
      </div>
      <div className="card mt-6 p-6">
        <h2 className="font-semibold">Need help with an order?</h2>
        <p className="muted mt-1">Your order history includes payment status and, for delivered purchases, a review form.</p>
        <Link href="/account/orders" className="link mt-3 inline-block text-sm">View orders →</Link>
      </div>
    </div>
  );
}
