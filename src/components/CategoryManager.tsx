"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
  product_count: number;
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function startEdit(category: Category) {
    setEditingId(category.category_id);
    setName(category.category_name);
    setParentId(category.parent_category_id ? String(category.parent_category_id) : "");
  }

  function reset() { setEditingId(null); setName(""); setParentId(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const body = {
        ...(editingId ? { category_id: editingId } : {}),
        category_name: name,
        parent_category_id: parentId ? Number(parentId) : null,
      };
      const response = await fetch("/api/admin/categories", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage(editingId ? "Category updated." : "Category created.");
      reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="card h-fit space-y-4 p-6">
        <h2 className="text-lg font-bold">{editingId ? "Edit category" : "New category"}</h2>
        <div><label className="label">Category name</label><input required className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <label className="label">Parent category</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None (top level)</option>
            {categories.filter((category) => category.category_id !== editingId && category.parent_category_id === null)
              .map((category) => <option key={category.category_id} value={category.category_id}>{category.category_name}</option>)}
          </select>
          <p className="muted mt-1">Only top-level categories can be parents; deeper nesting isn&apos;t offered here.</p>
        </div>
        {message && <p className="text-sm text-brand-700">{message}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 py-2.5">{pending ? "Saving..." : editingId ? "Update" : "Create"}</button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary py-2.5">Cancel</button>}
        </div>
      </form>

      <div className="card divide-y divide-slate-100">
        {categories.map((category) => (
          <div key={category.category_id} className="flex items-center justify-between gap-4 p-4">
            <div className="text-sm">
              <p className={`font-semibold ${category.parent_category_id ? "pl-6 text-slate-600" : ""}`}>
                {category.parent_category_id ? "↳ " : ""}{category.category_name}
              </p>
              <p className="muted">{category.product_count} products</p>
            </div>
            <button type="button" className="link text-sm" onClick={() => startEdit(category)}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
