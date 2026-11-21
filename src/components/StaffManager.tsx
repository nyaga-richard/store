"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Staff {
  staff_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function StaffManager({ staff, canManage, canDelete }: { staff: Staff[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const blank = { email: "", first_name: "", last_name: "", role: "staff", is_active: true, password: "" };
  const [form, setForm] = useState(blank);

  function startEdit(person: Staff) {
    setEditingId(person.staff_id);
    setForm({ email: person.email, first_name: person.first_name, last_name: person.last_name,
      role: person.role, is_active: person.is_active, password: "" });
  }

  function reset() { setEditingId(null); setForm(blank); setMessage(""); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const body = editingId ? { ...form, staff_id: editingId, password: form.password || undefined } : form;
      const response = await fetch("/api/admin/staff", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage(editingId ? "Staff account updated." : "Staff account created.");
      reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this staff account?")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: id }),
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

  if (!canManage) return <div className="card p-8 muted">Only owners and admins can manage staff accounts.</div>;

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="card h-fit space-y-4 p-6">
        <h2 className="text-lg font-bold">{editingId ? "Edit staff account" : "Add staff account"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name</label><input required className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><label className="label">Last name</label><input required className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
        </div>
        <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Role</label><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="owner">Owner</option>
          </select></div>
          <div><label className="label">{editingId ? "New password" : "Password"}</label><input type="password" minLength={8} required={!editingId} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-700" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        {message && <p className="text-sm text-brand-700">{message}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 py-2.5">{pending ? "Saving..." : editingId ? "Update" : "Create"}</button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary py-2.5">Cancel</button>}
        </div>
      </form>

      <div className="space-y-3">
        {staff.map((person) => (
          <div key={person.staff_id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">{person.first_name} {person.last_name} <span className="badge ml-2 bg-brand-50 text-brand-700">{person.role}</span> {!person.is_active && <span className="badge ml-2 bg-slate-100 text-slate-500">Disabled</span>}</p>
              <p className="muted">{person.email}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <button type="button" className="link" onClick={() => startEdit(person)}>Edit</button>
              {canDelete && <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => void remove(person.staff_id)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
