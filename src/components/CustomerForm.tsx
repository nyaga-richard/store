"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  customerId?: number;
  values: { email: string; first_name: string; last_name: string; phone: string | null };
  canDelete?: boolean;
}

export function CustomerForm({ customerId, values, canDelete }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ ...values, password: "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const body = { ...form, phone: form.phone || null, password: form.password || undefined };
      const response = await fetch(customerId ? `/api/admin/customers/${customerId}` : "/api/admin/customers", {
        method: customerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage("Customer saved.");
      setForm({ ...form, password: "" });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!customerId || !confirm("Delete this customer? Only customers with no order history can be deleted.")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Delete failed");
      router.push("/admin/customers");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">First name</label><input required className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
        <div><label className="label">Last name</label><input required className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
      </div>
      <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><label className="label">Phone</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><label className="label">{customerId ? "New password (leave blank to keep)" : "Password"}</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!customerId} minLength={8} /></div>
      {message && <p className="text-sm text-brand-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save customer"}</button>
        {canDelete && customerId && <button type="button" disabled={pending} onClick={remove} className="btn-secondary text-red-600">Delete customer</button>}
      </div>
    </form>
  );
}
