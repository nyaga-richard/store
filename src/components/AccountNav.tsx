"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/payment-methods", label: "Payment methods" },
  { href: "/account/profile", label: "Profile" },
];

export function AccountNav({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="card h-fit p-4 lg:w-60">
      <p className="px-3 pb-3 text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
      <p className="px-3 pb-4 text-sm font-semibold">{name}</p>
      <nav className="space-y-1">
        {links.map((link) => (
          <Link key={link.href} href={link.href}
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === link.href ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
            {link.label}
          </Link>
        ))}
        <button type="button" onClick={logout} className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Sign out</button>
      </nav>
    </aside>
  );
}
