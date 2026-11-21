import { getBackofficeUser } from "@/lib/admin";
import { query } from "@/lib/db";
import { SupplierManager } from "@/components/SupplierManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suppliers" };

export default async function AdminSuppliersPage() {
  const user = await getBackofficeUser();
  const suppliers = await query<{
    supplier_id: number; supplier_name: string; contact_name: string | null;
    email: string | null; phone: string | null; city: string | null;
  }>(`SELECT supplier_id, supplier_name, contact_name, email, phone, city FROM supplier ORDER BY supplier_name`);
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Suppliers</h2><p className="muted">Vendors used when creating purchase orders.</p></div>
      <SupplierManager suppliers={suppliers} canDelete={user?.role === "owner" || user?.role === "admin"} />
    </div>
  );
}
