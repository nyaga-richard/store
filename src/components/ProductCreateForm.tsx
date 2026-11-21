"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductCreateForm({ categories }: {
  categories: { category_id: number; category_name: string; parent_category_id: number | null }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    product_name: "", brand: "", description: "", sku: "", price: "0.00", qty_in_stock: "0",
    image_url: "", is_active: true, categoryIds: [] as number[],
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const file = formData.get("image");
      let imageUrl = form.image_url || null;
      if (file instanceof File && file.size > 0) {
        const uploadBody = new FormData();
        uploadBody.append("file", file);
        const uploadResponse = await fetch("/api/admin/uploads", { method: "POST", body: uploadBody });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadPayload.ok) throw new Error(uploadPayload.error?.message || "Image upload failed");
        imageUrl = uploadPayload.data.url;
      }
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          qty_in_stock: Number(form.qty_in_stock),
          image_url: imageUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Create failed");
      router.push(`/admin/products/${payload.data.productId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Product name</label><input required className="input" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
        <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
        <div><label className="label">Or image URL</label><input className="input" value={form.image_url} placeholder="https://..." onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Upload product image (JPG, PNG, WebP or GIF, max 5 MB)</label><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={4} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="label">First SKU</label><input required className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
        <div><label className="label">Price (KES)</label><input required className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div><label className="label">Initial stock</label><input type="number" min={0} className="input" value={form.qty_in_stock} onChange={(e) => setForm({ ...form, qty_in_stock: e.target.value })} /></div>
      </div>
      <fieldset>
        <legend className="label">Categories</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.category_id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-700" checked={form.categoryIds.includes(category.category_id)}
                onChange={(event) => setForm({ ...form, categoryIds: event.target.checked
                  ? [...form.categoryIds, category.category_id]
                  : form.categoryIds.filter((id) => id !== category.category_id) })} />
              {category.category_name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-700" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible in storefront</label>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Creating..." : "Create product"}</button>
    </form>
  );
}
