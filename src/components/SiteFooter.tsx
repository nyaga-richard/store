import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm font-black text-white">
              {settings.site_name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="font-bold">{settings.site_name}</span>
          </div>
          <p className="muted mt-3 max-w-xs">{settings.footer_note}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">Shop</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><Link href="/products" className="hover:text-brand-700">All products</Link></li>
            <li><Link href="/products?sort=price-asc" className="hover:text-brand-700">Under KES 5,000</Link></li>
            <li><Link href="/products?sort=newest" className="hover:text-brand-700">New arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">Your account</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><Link href="/account/orders" className="hover:text-brand-700">Order history</Link></li>
            <li><Link href="/account/addresses" className="hover:text-brand-700">Addresses</Link></li>
            <li><Link href="/account/payment-methods" className="hover:text-brand-700">Payment methods</Link></li>
            <li><Link href="/account/profile" className="hover:text-brand-700">Profile</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">Support</h3>
          <p className="muted">{settings.support_address}<br />{settings.support_hours}</p>
          <p className="muted mt-2">{settings.support_email}</p>
          <p className="muted">{settings.support_phone}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {settings.site_name}. All rights reserved.
      </div>
    </footer>
  );
}
