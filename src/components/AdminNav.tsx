"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/products", label: "Products & stock" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/settings", label: "Site settings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/products/new", label: "Add product" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/purchases", label: "Purchases" },
  { href: "/admin/staff", label: "Staff & roles" },
];

export function AdminNav({ email, displayName, role }: { email: string; displayName: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="card h-fit p-4 lg:w-60">
      <p className="px-3 pb-1 text-xs uppercase tracking-wide text-slate-400">Signed in as {displayName}</p>
      <p className="break-all px-3 pb-1 text-xs font-semibold">{email}</p>
      <p className="px-3 pb-4 text-xs text-slate-400">Role: {role}</p>
      <nav className="space-y-1">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          if (["/admin/staff", "/admin/payments"].includes(link.href) && !["owner", "admin"].includes(role)) return null;
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
