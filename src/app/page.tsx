import Image from "next/image";
import Link from "next/link";
import { getCategoryTree, getFeaturedProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, categories] = await Promise.all([getFeaturedProducts(8), getCategoryTree()]);
  const topLevel = categories.filter((category) => !category.parent_category_id);
  const deals = products.filter((product) => product.discount_percent > 0);

  return (
    <>
      <section className="container-page grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
        <div>
          <span className="badge bg-brand-50 text-brand-700">Kenya-wide delivery · Secure checkout</span>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Good tech.<br /><span className="text-brand-700">Fair prices.</span><br />Fast delivery.
          </h1>
          <p className="mt-5 max-w-lg text-base text-slate-600 sm:text-lg">
            Discover headphones, smartwatches, keyboards and home essentials from Trusted Systems. Transparent pricing, real stock, and payments you can trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary">Shop all products →</Link>
            <Link href="/products?sort=price-asc" className="btn-secondary">Shop under KES 5,000</Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            {[["24h", "Order support"], ["KES", "Exact pricing"], ["1yr", "Warranty"]].map(([value, label]) => (
              <div key={label}>
                <dt className="text-lg font-bold text-slate-900">{value}</dt>
                <dd className="text-xs text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-xl">
          <Image src="https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1400&q=80"
            alt="Curated tech products" fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute bottom-5 left-5 rounded-xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-xs font-semibold text-slate-500">Featured this week</p>
            <p className="text-sm font-bold text-slate-900">Audio & wearables from Nova</p>
          </div>
        </div>
      </section>

      <section className="container-page py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-title">Shop by category</h2>
            <p className="muted mt-1">Find exactly what you need, faster.</p>
          </div>
          <Link href="/products" className="link text-sm">View all →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {topLevel.map((category) => (
            <Link key={category.category_id} href={`/products?category=${category.category_id}`}
              className="card flex items-center justify-between p-5 transition hover:border-brand-600 hover:shadow-md">
              <div>
                <h3 className="font-semibold">{category.category_name}</h3>
                <p className="muted mt-1">{category.product_count} products</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-title">New arrivals</h2>
            <p className="muted mt-1">The latest additions to our catalogue.</p>
          </div>
          <Link href="/products" className="link text-sm">Browse catalogue →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => <ProductCard key={product.product_id} product={product} />)}
        </div>
      </section>

      {deals.length > 0 && (
        <section className="bg-brand-700 py-12 text-white">
          <div className="container-page">
            <div className="mb-6">
              <h2 className="text-2xl font-bold sm:text-3xl">Deals live right now</h2>
              <p className="mt-1 text-sm text-brand-100">Promotions are applied automatically at checkout — no codes needed.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {deals.slice(0, 4).map((product) => (
                <Link key={product.product_id} href={`/products/${product.product_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/10 p-4 backdrop-blur transition hover:bg-white/20">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{product.product_name}</p>
                    <p className="text-xs text-brand-100">Save {product.discount_percent}%</p>
                  </div>
                  <span className="text-sm font-bold">KES {product.effective_cents.toLocaleString("en-KE")}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
