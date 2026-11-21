"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ user }: { user: { first_name: string; last_name: string; email: string; phone: string | null } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Update failed");
      setMessage("Profile updated.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="first_name">First name</label><input id="first_name" name="first_name" required defaultValue={user.first_name} className="input" /></div>
        <div><label className="label" htmlFor="last_name">Last name</label><input id="last_name" name="last_name" required defaultValue={user.last_name} className="input" /></div>
      </div>
      <div><label className="label">Email</label><input value={user.email} disabled className="input bg-slate-50" /><p className="muted mt-1">Email cannot be changed here.</p></div>
      <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={user.phone ?? ""} className="input" /></div>
      {message && <p className="text-sm text-brand-700">{message}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Saving..." : "Save changes"}</button>
    </form>
  );
}
