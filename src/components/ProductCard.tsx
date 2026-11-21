import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/types";
import { Price } from "./Price";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <article className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/products/${product.product_id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.product_name} fill sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105" />
        ) : <div className="img-shell h-full w-full" />}
        {product.discount_percent > 0 && (
          <span className="badge absolute left-3 top-3 bg-accent text-white">-{product.discount_percent}%</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {product.brand && <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{product.brand}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
          <Link href={`/products/${product.product_id}`} className="hover:underline">{product.product_name}</Link>
        </h3>
        <p className="mt-1 muted">{product.variant_count} {product.variant_count === 1 ? "option" : "options"}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <Price cents={product.effective_cents} className="text-lg font-bold text-slate-900" />
            {product.discount_percent > 0 && (
              <div className="text-xs text-slate-400 line-through"><Price cents={product.price_cents} /></div>
            )}
          </div>
          <Link href={`/products/${product.product_id}`} className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100">
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
