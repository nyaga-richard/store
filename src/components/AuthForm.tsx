"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Could not continue");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "register" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="first_name">First name</label><input id="first_name" name="first_name" required maxLength={100} className="input" /></div>
          <div><label className="label" htmlFor="last_name">Last name</label><input id="last_name" name="last_name" required maxLength={100} className="input" /></div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </div>
      {mode === "register" && (
        <div><label className="label" htmlFor="phone">Phone (optional)</label><input id="phone" name="phone" maxLength={30} className="input" placeholder="+2547..." /></div>
      )}
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} className="input" />
        {mode === "register" && <p className="muted mt-1">At least 8 characters. Stored as a salted scrypt hash.</p>}
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="text-center text-sm text-slate-500">
        {mode === "login" ? <>New here? <Link href="/register" className="link">Create an account</Link></> : <>Already have an account? <Link href="/login" className="link">Sign in</Link></>}
      </p>
    </form>
  );
}
