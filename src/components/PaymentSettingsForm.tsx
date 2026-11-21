"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SecretKey = "stripe_secret_key" | "stripe_webhook_secret" | "mpesa_consumer_secret" | "mpesa_passkey" | "mpesa_callback_secret";

interface Props {
  values: Record<string, string>;
  canEdit: boolean;
  callbackUrl: string;
}

export function PaymentSettingsForm({ values, canEdit, callbackUrl }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({
    card_provider: values.card_provider || "mock",
    stripe_enabled: values.stripe_enabled || "false",
    stripe_publishable_key: values.stripe_publishable_key || "",
    mpesa_enabled: values.mpesa_enabled || "false",
    mpesa_consumer_key: values.mpesa_consumer_key || "",
    mpesa_shortcode: values.mpesa_shortcode || "",
    mpesa_environment: values.mpesa_environment || "sandbox",
  });
  const [secrets, setSecrets] = useState<Record<SecretKey, string>>({
    stripe_secret_key: "", stripe_webhook_secret: "", mpesa_consumer_secret: "", mpesa_passkey: "", mpesa_callback_secret: "",
  });
  const [clear, setClear] = useState<SecretKey[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function set(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function setSecret(key: SecretKey, value: string) { setSecrets((current) => ({ ...current, [key]: value })); }
  function toggleClear(key: SecretKey) {
    setClear((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = { ...form, clearSecrets: clear };
      for (const [key, value] of Object.entries(secrets)) if (value) body[key] = value;
      const response = await fetch("/api/admin/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Save failed");
      setMessage("Payment settings saved. Existing secrets were kept unless you entered a new value.");
      setSecrets({ stripe_secret_key: "", stripe_webhook_secret: "", mpesa_consumer_secret: "", mpesa_passkey: "", mpesa_callback_secret: "" });
      setClear([]);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  const secretFields: { key: SecretKey; label: string }[] = [
    { key: "stripe_secret_key", label: "Stripe secret key" },
    { key: "stripe_webhook_secret", label: "Stripe webhook signing secret" },
    { key: "mpesa_consumer_secret", label: "M-Pesa consumer secret" },
    { key: "mpesa_passkey", label: "M-Pesa passkey" },
    { key: "mpesa_callback_secret", label: "M-Pesa callback secret (URL query token)" },
  ];

  if (!canEdit) return <div className="card p-8 muted">Only owners and admins can change payment settings.</div>;

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <section className="card space-y-4 p-6">
        <div>
          <h3 className="font-bold">Card payments (Stripe)</h3>
          <p className="muted">Customers enter card details only in Stripe&apos;s secure card field. Raw card numbers never reach this server.</p>
        </div>
        <div>
          <label className="label" htmlFor="card_provider">Card provider</label>
          <select id="card_provider" className="input" value={form.card_provider} onChange={(e) => set("card_provider", e.target.value)}>
            <option value="mock">Mock (demos only)</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-700" checked={form.stripe_enabled === "true"}
            onChange={(e) => set("stripe_enabled", e.target.checked ? "true" : "false")} />
          Accept live card payments with Stripe
        </label>
        <div>
          <label className="label" htmlFor="stripe_publishable_key">Stripe publishable key <span className="muted">(safe for the browser)</span></label>
          <input id="stripe_publishable_key" className="input" placeholder="pk_live_..." value={form.stripe_publishable_key} onChange={(e) => set("stripe_publishable_key", e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h3 className="font-bold">M-Pesa (Safaricom Daraja)</h3>
          <p className="muted">Sends an STK push to the customer&apos;s phone. Amounts must be whole shillings.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-700" checked={form.mpesa_enabled === "true"}
            onChange={(e) => set("mpesa_enabled", e.target.checked ? "true" : "false")} />
          Accept M-Pesa payments
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="mpesa_consumer_key">Consumer key</label><input id="mpesa_consumer_key" className="input" value={form.mpesa_consumer_key} onChange={(e) => set("mpesa_consumer_key", e.target.value)} /></div>
          <div><label className="label" htmlFor="mpesa_shortcode">Shortcode / paybill</label><input id="mpesa_shortcode" className="input" value={form.mpesa_shortcode} onChange={(e) => set("mpesa_shortcode", e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="mpesa_environment">Environment</label>
            <select id="mpesa_environment" className="input" value={form.mpesa_environment} onChange={(e) => set("mpesa_environment", e.target.value)}>
              <option value="sandbox">Sandbox</option><option value="production">Production</option>
            </select>
          </div>
        </div>
        <p className="muted break-all text-xs">Register this callback URL in Daraja: <code>{callbackUrl}?secret=&lt;your callback secret&gt;</code></p>
      </section>

      <section className="card space-y-4 p-6">
        <h3 className="font-bold">Secrets</h3>
        <p className="muted text-sm">Stored server-side only. Leave blank to keep the current value, or tick Clear to remove it.</p>
        {secretFields.map((field) => (
          <div key={field.key} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-center">
            <label className="label" htmlFor={`secret-${field.key}`}>{field.label}</label>
            <input id={`secret-${field.key}`} type="password" autoComplete="off" className="input"
              placeholder={values[field.key] ? `Saved: ${values[field.key]}` : "Not configured"}
              value={secrets[field.key]} onChange={(e) => setSecret(field.key, e.target.value)} />
            <label className="flex items-center gap-1 text-xs text-red-600">
              <input type="checkbox" checked={clear.includes(field.key)} onChange={() => toggleClear(field.key)} /> Clear
            </label>
          </div>
        ))}
      </section>

      {message && <p className="text-sm text-brand-700">{message}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save payment settings"}</button>
    </form>
  );
}
