"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Variant {
  variant_id: number;
  sku: string;
  price: string;
  qty_in_stock: number;
  option_summary: string | null;
}

interface Props {
  product: {
    product_id: number;
    product_name: string;
    description: string | null;
    brand: string | null;
    category_ids: number[];
    variants: Variant[];
  };
  categories: { category_id: number; category_name: string; parent_category_id: number | null }[];
}

export function ProductAdminForm({ product, categories }: Props) {
  const router = useRouter();
  const [productName, setProductName] = useState(product.product_name);
  const [description, setDescription] = useState(product.description || "");
  const [brand, setBrand] = useState(product.brand || "");
  const [categoryIds, setCategoryIds] = useState<number[]>(product.category_ids);
  const [variants, setVariants] = useState(product.variants.map((v) => ({ ...v })));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${product.product_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: productName,
          description,
          brand,
          categoryIds,
          variants: variants.map((v) => ({ variant_id: v.variant_id, price: v.price, qty_in_stock: Number(v.qty_in_stock) })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage({ ok: true, text: "Product saved." });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card p-6">
        <h2 className="text-lg font-bold">Product details</h2>
        <div className="mt-4 grid gap-4">
          <div><label className="label">Product name</label><input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} required /></div>
          <div><label className="label">Brand</label><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <fieldset className="mt-5">
          <legend className="label">Categories</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label key={category.category_id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-brand-700"
                  checked={categoryIds.includes(category.category_id)}
                  onChange={(event) => setCategoryIds((current) => event.target.checked
                    ? [...current, category.category_id]
                    : current.filter((id) => id !== category.category_id))} />
                {category.parent_category_id ? <span className="pl-3 text-slate-500">{category.category_name}</span> : <span className="font-medium">{category.category_name}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">Variants & stock</h2>
        <p className="muted mb-4">Prices are exact decimal amounts. Stock is checked again under a row lock at checkout.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">SKU</th><th className="pb-2">Option</th><th className="pb-2">Price (KES)</th><th className="pb-2">In stock</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map((variant, index) => (
                <tr key={variant.variant_id}>
                  <td className="py-3 font-mono text-xs">{variant.sku}</td>
                  <td className="py-3 text-slate-500">{variant.option_summary || "Default"}</td>
                  <td className="py-3"><input className="input w-36" value={variant.price} onChange={(e) => setVariants((all) => all.map((v, i) => i === index ? { ...v, price: e.target.value } : v))} /></td>
                  <td className="py-3"><input type="number" min={0} className="input w-24" value={variant.qty_in_stock} onChange={(e) => setVariants((all) => all.map((v, i) => i === index ? { ...v, qty_in_stock: Number(e.target.value) } : v))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && <p className={`text-sm ${message.ok ? "text-brand-700" : "text-red-600"}`}>{message.text}</p>}
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save product"}</button>
    </form>
  );
}
