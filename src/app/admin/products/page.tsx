import Link from "next/link";
import { listAdminProducts } from "@/lib/admin-data";
import { formatMoney, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products & stock" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = (q || "").slice(0, 100);
  const products = await listAdminProducts(search);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-xl font-bold">Products & stock</h2><p className="muted">{products.length} products</p></div>
        <form action="/admin/products" method="get" className="flex gap-2">
          <input name="q" defaultValue={search} placeholder="Search name or brand..." className="input w-56" />
          <button className="btn-secondary py-2.5">Search</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Variants</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">From</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => (
              <tr key={product.product_id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="font-semibold">{product.product_name} {!product.is_active && <span className="badge ml-2 bg-slate-100 text-slate-500">Hidden</span>}</p>
                  <p className="muted">{product.brand || "—"}</p>
                </td>
                <td className="px-5 py-3">{product.variant_count}</td>
                <td className="px-5 py-3">
                  <span className={product.stock < 5 ? "font-semibold text-amber-600" : ""}>{product.stock}</span>
                </td>
                <td className="px-5 py-3">{formatMoney(toCents(product.min_price))}</td>
                <td className="px-5 py-3"><Link href={`/admin/products/${product.product_id}`} className="link">Edit →</Link></td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
