import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { CartControls } from "@/components/CartControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const cart = await getCart(await getCurrentUser());

  return (
    <div className="container-page py-10">
      <h1 className="section-title">Your cart</h1>
      <p className="muted mt-1">{cart.count} {cart.count === 1 ? "item" : "items"} in your basket</p>

      {cart.lines.length === 0 ? (
        <div className="card mt-8 grid place-items-center p-16 text-center">
          <div>
            <div className="text-5xl">🛒</div>
            <p className="mt-4 text-lg font-semibold">Your cart is empty</p>
            <p className="muted mt-2">Browse the catalogue and find something you love.</p>
            <Link href="/products" className="btn-primary mt-5">Start shopping</Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="card divide-y divide-slate-100">
            {cart.lines.map((line) => (
              <div key={line.variant_id} className="flex gap-4 p-4 sm:p-5">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {line.image_url ? <Image src={line.image_url} alt={line.product_name} fill sizes="96px" className="object-cover" /> : <div className="img-shell h-full w-full" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${line.product_id}`} className="font-semibold hover:underline">{line.product_name}</Link>
                  {line.option_summary && <p className="muted">{line.option_summary}</p>}
                  {!line.is_active && <p className="text-xs font-semibold text-red-600">No longer available — remove to check out</p>}
                  <p className="muted">SKU: {line.sku}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <CartControls variantId={line.variant_id} quantity={line.quantity} stock={line.available} />
                    <span className="font-semibold">{formatMoney(line.unit_price_cents * line.quantity)}</span>
                    {line.discount_cents > 0 && <span className="badge bg-amber-50 text-amber-700">Promo applied</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="card h-fit p-6">
            <h2 className="text-lg font-bold">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(cart.subtotal_cents + cart.discount_cents)}</dd></div>
              {cart.discount_cents > 0 && <div className="flex justify-between text-brand-700"><dt>Promotions</dt><dd>−{formatMoney(cart.discount_cents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd>Calculated at checkout</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><dt>Total</dt><dd>{formatMoney(cart.total_cents)}</dd></div>
            </dl>
            <Link href="/checkout" className="btn-primary mt-6 w-full">Proceed to checkout</Link>
            <Link href="/products" className="btn-ghost mt-2 w-full">Continue shopping</Link>
            <p className="muted mt-4 text-center">Stock and totals are finalised securely at checkout.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
