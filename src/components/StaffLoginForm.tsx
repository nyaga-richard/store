"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function StaffLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Sign in failed");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label" htmlFor="staff-email">Staff email</label><input id="staff-email" name="email" type="email" required className="input" /></div>
      <div><label className="label" htmlFor="staff-password">Password</label><input id="staff-password" name="password" type="password" required className="input" /></div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Signing in..." : "Sign in to backoffice"}</button>
      <p className="text-center text-sm text-slate-500">
        Allowlisted owner? <Link href="/login?next=/admin" className="link">Sign in as customer instead</Link>
      </p>
    </form>
  );
}
