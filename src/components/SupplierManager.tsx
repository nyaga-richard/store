"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
}

const blank = { supplier_name: "", contact_name: "", email: "", phone: "", address_line1: "", city: "" };

export function SupplierManager({ suppliers, canDelete }: { suppliers: Supplier[]; canDelete: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function startEdit(item: Supplier) {
    setEditingId(item.supplier_id);
    setForm({ supplier_name: item.supplier_name, contact_name: item.contact_name || "", email: item.email || "",
      phone: item.phone || "", address_line1: "", city: item.city || "" });
  }
  function reset() { setEditingId(null); setForm(blank); setMessage(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, supplier_id: editingId } : form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage(editingId ? "Supplier updated." : "Supplier created.");
      reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this supplier?")) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id: id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Delete failed");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="card h-fit space-y-4 p-6">
        <h2 className="text-lg font-bold">{editingId ? "Edit supplier" : "Add supplier"}</h2>
        <div><label className="label">Supplier name</label><input required className="input" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} /></div>
        <div><label className="label">Contact name</label><input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div><label className="label">Address</label><input className="input" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
        <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        {message && <p className="text-sm text-brand-700">{message}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 py-2.5">{pending ? "Saving..." : editingId ? "Update" : "Create supplier"}</button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary py-2.5">Cancel</button>}
        </div>
      </form>
      <div className="space-y-3">
        {suppliers.map((supplier) => (
          <div key={supplier.supplier_id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div><p className="font-semibold">{supplier.supplier_name}</p><p className="muted">{supplier.contact_name || "—"} · {supplier.phone || supplier.email || "—"} · {supplier.city || "—"}</p></div>
            <div className="flex gap-3 text-sm">
              <button type="button" className="link" onClick={() => startEdit(supplier)}>Edit</button>
              {canDelete && <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => void remove(supplier.supplier_id)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
