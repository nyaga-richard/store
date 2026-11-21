import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCategoryTree } from "@/lib/catalog";
import { getCartCount } from "@/lib/cart";
import { getSiteSettings } from "@/lib/site-settings";

export async function SiteHeader() {
  const [categories, user, settings] = await Promise.all([getCategoryTree(), getCurrentUser(), getSiteSettings()]);
  const cartCount = await getCartCount(user);
  const topLevel = categories.filter((category) => !category.parent_category_id);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="bg-brand-700 py-1.5 text-center text-xs font-medium text-white">
        {settings.announcement}
      </div>
      <div className="container-page flex h-16 items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${settings.site_name} home`}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-black text-white">
            {settings.site_name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block">{settings.site_name}</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 lg:flex">
          <Link href="/products" className="hover:text-brand-700">All products</Link>
          {topLevel.slice(0, 4).map((category) => (
            <Link key={category.category_id} href={`/products?category=${category.category_id}`} className="hover:text-brand-700">
              {category.category_name}
            </Link>
          ))}
        </nav>

        <form action="/products" method="get" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <input id="site-search" name="q" type="search" placeholder="Search products..." className="input py-2" />
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href={user ? "/account" : "/login"} className="btn-ghost px-3" aria-label="My account">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
            </svg>
            <span className="hidden text-sm sm:inline">{user ? "Account" : "Sign in"}</span>
          </Link>
          <Link href="/cart" className="btn-ghost relative px-3" aria-label={`Cart, ${cartCount} items`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
              <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
            </svg>
            <span className="hidden text-sm sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          <details className="relative lg:hidden">
            <summary className="btn-ghost cursor-pointer list-none px-3" aria-label="Open menu">☰</summary>
            <div className="absolute right-0 top-10 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <Link href="/products" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">All products</Link>
              {categories.map((category) => (
                <Link key={category.category_id} href={`/products?category=${category.category_id}`}
                  className={`block rounded-lg px-3 py-2 text-sm hover:bg-slate-50 ${category.parent_category_id ? "pl-6 text-slate-500" : "font-medium"}`}>
                  {category.category_name}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
