import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { ImageGallery } from "@/components/ImageGallery";
import { AddToCartForm } from "@/components/AddToCartForm";
import { Price } from "@/components/Price";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();
  const product = await getProduct(productId);
  if (!product) notFound();

  const galleryImages = product.images.map((image) => ({ image_id: image.image_id, image_url: image.image_url }));

  return (
    <div className="container-page py-8">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> <span className="mx-2">/</span>
        <Link href="/products" className="hover:underline">Products</Link> <span className="mx-2">/</span>
        <span className="text-slate-900">{product.product_name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={galleryImages} name={product.product_name} fallback={product.image_url} />

        <div>
          {product.brand && <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{product.brand}</p>}
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{product.product_name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-accent">★</span>
            <span className="text-sm text-slate-600">
              {product.rating_avg > 0 ? `${product.rating_avg} out of 5 (${product.reviews.length} reviews)` : "No reviews yet"}
            </span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <Price cents={product.effective_cents} className="text-4xl font-black text-slate-900" />
            {product.discount_percent > 0 && (
              <>
                <Price cents={product.price_cents} className="pb-1 text-lg text-slate-400 line-through" />
                <span className="badge mb-1 bg-accent text-white">Save {product.discount_percent}%</span>
              </>
            )}
          </div>
          <p className="muted mt-1">Prices include VAT. Promotion applied automatically at checkout.</p>

          <p className="mt-6 leading-relaxed text-slate-600">{product.description || "A quality product from Trusted Systems Store."}</p>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <AddToCartForm productName={product.product_name}
              options={product.options} variants={product.variants} />
          </div>

          <ul className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-200 pt-6 text-center text-xs text-slate-600">
            <li><span className="mb-1 block text-xl">🚚</span>Kenya-wide delivery</li>
            <li><span className="mb-1 block text-xl">🔒</span>Secure payment</li>
            <li><span className="mb-1 block text-xl">↩️</span>7-day returns</li>
          </ul>
        </div>
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="section-title text-xl">Customer reviews</h2>
          {product.reviews.length === 0 ? (
            <p className="muted mt-3">No reviews yet. Verified buyers can leave a review from their order history.</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {product.reviews.map((review) => (
                <article key={review.review_id} className="py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{review.reviewer}</p>
                    <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString("en-KE")}</p>
                  </div>
                  <p className="text-accent">{"★".repeat(review.rating)}<span className="text-slate-300">{"★".repeat(5 - review.rating)}</span></p>
                  {review.comment && <p className="mt-1 text-sm text-slate-600">{review.comment}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
        <aside className="card h-fit p-5">
          <h3 className="font-semibold">Why shop with us?</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>✓ Genuine products, clearly described</li>
            <li>✓ Live stock levels at checkout</li>
            <li>✓ Exact decimal pricing — no surprises</li>
            <li>✓ Reviews only from verified purchases</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
