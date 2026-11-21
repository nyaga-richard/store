"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Address, Country } from "@/lib/types";

export function AddressManager({ addresses, countries }: { addresses: Address[]; countries: Country[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    address_line1: "", address_line2: "", city: "", region: "", postal_code: "",
    country_id: countries.find((c) => c.country_name === "Kenya")?.country_id ?? countries[0]?.country_id ?? 0,
    is_default: addresses.length === 0,
  });

  async function request(method: "POST" | "PATCH" | "DELETE", body: object) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account/addresses", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Request failed");
      router.refresh();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">Saved addresses</h2>
        <button type="button" className="btn-secondary py-2" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add address"}</button>
      </div>

      {showForm && (
        <form className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          void request("POST", form);
        }}>
          <div className="sm:col-span-2"><label className="label">Address line 1</label><input required className="input" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Address line 2</label><input className="input" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} /></div>
          <div><label className="label">City</label><input required className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">Region</label><input className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
          <div><label className="label">Postal code</label><input className="input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
          <div><label className="label">Country</label><select className="input" value={form.country_id} onChange={(e) => setForm({ ...form, country_id: Number(e.target.value) })}>
            {countries.map((country) => <option key={country.country_id} value={country.country_id}>{country.country_name}</option>)}
          </select></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-brand-700" /> Set as default</label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save address"}</button></div>
        </form>
      )}

      {addresses.length === 0 ? <div className="card p-8 text-center muted">No saved addresses yet.</div> : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.address_id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="text-sm">
                <p className="font-semibold">{address.address_line1} {address.is_default && <span className="badge ml-2 bg-brand-50 text-brand-700">Default</span>}</p>
                {address.address_line2 && <p className="muted">{address.address_line2}</p>}
                <p className="muted">{address.city}{address.region ? `, ${address.region}` : ""} {address.postal_code}</p>
                <p className="muted">{address.country_name}</p>
              </div>
              <div className="flex gap-2 text-sm">
                {!address.is_default && <button type="button" disabled={pending} className="link" onClick={() => void request("PATCH", { addressId: address.address_id, is_default: true })}>Make default</button>}
                <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => void request("DELETE", { addressId: address.address_id })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
