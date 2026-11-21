"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/lib/site-settings";

const fields: { key: keyof SiteSettings; label: string; hint?: string; multiline?: boolean }[] = [
  { key: "site_name", label: "Store name" },
  { key: "announcement", label: "Announcement bar", hint: "Shown at the top of every page." },
  { key: "hero_title", label: "Home hero title", hint: "Use a new line for each line of the heading.", multiline: true },
  { key: "hero_subtitle", label: "Home hero description", multiline: true },
  { key: "support_email", label: "Support email" },
  { key: "support_phone", label: "Support phone" },
  { key: "support_hours", label: "Support hours" },
  { key: "support_address", label: "Support address" },
  { key: "footer_note", label: "Footer description", multiline: true },
  { key: "free_shipping_threshold", label: "Free shipping threshold (KES)", hint: "Numeric value only." },
];

export function SiteSettingsForm({ settings, canEdit }: { settings: SiteSettings; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage("Settings saved. Reload the storefront to see changes.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) return <div className="card p-8 muted">Only owners and admins can change site settings.</div>;

  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-4 p-6">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="label" htmlFor={`setting-${field.key}`}>{field.label}</label>
          {field.multiline ? (
            <textarea id={`setting-${field.key}`} rows={3} className="input" value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
          ) : (
            <input id={`setting-${field.key}`} className="input" value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
          )}
          {field.hint && <p className="muted mt-1">{field.hint}</p>}
        </div>
      ))}
      {message && <p className="text-sm text-brand-700">{message}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save settings"}</button>
    </form>
  );
}
