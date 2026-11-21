"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/products", label: "Products & stock" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/categories", label: "Categories" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="card h-fit p-4 lg:w-60">
      <p className="px-3 pb-1 text-xs uppercase tracking-wide text-slate-400">Signed in as admin</p>
      <p className="break-all px-3 pb-4 text-xs font-semibold">{email}</p>
      <nav className="space-y-1">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
              {link.label}
            </Link>
          );
        })}
        <Link href="/" className="mt-3 block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">← Back to store</Link>
        <button type="button" onClick={logout} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Sign out</button>
      </nav>
    </aside>
  );
}
