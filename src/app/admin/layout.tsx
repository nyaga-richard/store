import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Administration</p>
          <h1 className="section-title">Store dashboard</h1>
        </div>
        <span className="badge bg-amber-50 text-amber-800">Private · {user.displayName} · {user.role}</span>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <AdminNav email={user.email} displayName={user.displayName} role={user.role} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
