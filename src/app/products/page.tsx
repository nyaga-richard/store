import Link from "next/link";
import { getCategoryTree, listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop all products" };

type Params = { category?: string; q?: string; sort?: string; page?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const categoryId = Number(raw.category) || undefined;
  const page = Math.max(1, Number(raw.page) || 1);
  const sort = (["newest", "price-asc", "price-desc", "name"].includes(raw.sort || "") ? raw.sort : "newest") as "newest" | "price-asc" | "price-desc" | "name";
  const search = (raw.q || "").slice(0, 100);

  const [categories, result] = await Promise.all([
    getCategoryTree(),
    listProducts({ categoryId, search, sort, page, limit: 24 }),
  ]);
  const selected = categories.find((category) => category.category_id === categoryId);
  const children = categories.filter((category) => category.parent_category_id === categoryId);
  const parent = selected?.parent_category_id ? categories.find((c) => c.category_id === selected.parent_category_id) : null;

  function hrefWith(patch: Partial<Params>) {
    const params = new URLSearchParams();
    if (categoryId) params.set("category", String(categoryId));
    if (search) params.set("q", search);
    if (sort !== "newest") params.set("sort", sort);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) params.delete(key); else params.set(key, value);
    });
    const query = params.toString();
    return `/products${query ? `?${query}` : ""}`;
  }

  return (
    <div className="container-page py-10">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> <span className="mx-2">/</span>
        {parent && <><Link href={`/products?category=${parent.category_id}`} className="hover:underline">{parent.category_name}</Link><span className="mx-2">/</span></>}
        <span className="text-slate-900">{selected?.category_name ?? "All products"}</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">{selected?.category_name ?? (search ? `Results for “${search}”` : "All products")}</h1>
          <p className="muted mt-1">{result.total} {result.total === 1 ? "product" : "products"}</p>
        </div>
        <form action="/products" method="get" className="flex flex-wrap items-center gap-2">
          {categoryId && <input type="hidden" name="category" value={categoryId} />}
          <input name="q" defaultValue={search} placeholder="Search catalogue..." className="input w-44 sm:w-56" aria-label="Search products" />
          <select name="sort" defaultValue={sort} className="input w-40" aria-label="Sort products">
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
          <button type="submit" className="btn-secondary py-2.5">Apply</button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Categories</h2>
          <ul className="space-y-1 text-sm">
            <li><Link href="/products" className={`block rounded-lg px-3 py-2 ${!categoryId ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}>All products</Link></li>
            {categories.filter((c) => !c.parent_category_id).map((category) => {
              const subs = categories.filter((c) => c.parent_category_id === category.category_id);
              return (
                <li key={category.category_id}>
                  <Link href={`/products?category=${category.category_id}`}
                    className={`block rounded-lg px-3 py-2 ${categoryId === category.category_id ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}>
                    {category.category_name} <span className="text-xs text-slate-400">({category.product_count})</span>
                  </Link>
                  {subs.length > 0 && (
                    <ul className="ml-3 border-l border-slate-200 pl-2">
                      {subs.map((sub) => (
                        <li key={sub.category_id}>
                          <Link href={`/products?category=${sub.category_id}`}
                            className={`block rounded-lg px-3 py-1.5 text-xs ${categoryId === sub.category_id ? "font-semibold text-brand-700" : "text-slate-500 hover:text-brand-700"}`}>
                            {sub.category_name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          {(selected || parent || children.length > 0) && (
            <div className="mb-5 flex flex-wrap gap-2">
              {parent && <Link href={`/products?category=${parent.category_id}`} className="badge bg-slate-100 text-slate-600">← {parent.category_name}</Link>}
              {children.map((child) => (
                <Link key={child.category_id} href={`/products?category=${child.category_id}`} className="badge bg-white text-slate-600 ring-1 ring-slate-200">{child.category_name}</Link>
              ))}
            </div>
          )}
          {result.items.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div>
                <p className="text-lg font-semibold">No products found</p>
                <p className="muted mt-2">Try another search or browse all products.</p>
                <Link href="/products" className="btn-secondary mt-4">Clear filters</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {result.items.map((product) => <ProductCard key={product.product_id} product={product} />)}
            </div>
          )}
          {result.pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
              {Array.from({ length: result.pages }, (_, index) => index + 1).map((number) => (
                <Link key={number} href={hrefWith({ page: number === 1 ? undefined : String(number) })}
                  className={`grid h-9 w-9 place-items-center rounded-lg border ${number === result.page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                  {number}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
