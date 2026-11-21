import Link from "next/link";
import { notFound } from "next/navigation";
import { getBackofficeUser } from "@/lib/admin";
import { queryOne } from "@/lib/db";
import { CustomerForm } from "@/components/CustomerForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit customer" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();
  const customer = await queryOne<{ email: string; first_name: string; last_name: string; phone: string | null }>(
    `SELECT email, first_name, last_name, phone FROM customer WHERE customer_id = $1`, [customerId]);
  if (!customer) notFound();
  const user = await getBackofficeUser();
  return (
    <div>
      <Link href="/admin/customers" className="link text-sm">← Customers</Link>
      <h2 className="mb-5 mt-3 text-xl font-bold">Edit customer #{customerId}</h2>
      <CustomerForm customerId={customerId} values={customer}
        canDelete={user?.role === "owner" || user?.role === "admin"} />
    </div>
  );
}
