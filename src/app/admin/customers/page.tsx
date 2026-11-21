import Link from "next/link";
import { listAdminCustomers } from "@/lib/admin-data";
import { formatMoney, toCents } from "@/lib/money";
import { CustomerForm } from "@/components/CustomerForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const search = (q || "").slice(0, 100);
  const customers = await listAdminCustomers(search);
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Customers</h2><p className="muted">Search, add and manage customer accounts.</p></div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <form action="/admin/customers" method="get" className="mb-4 flex gap-2">
            <input name="q" defaultValue={search} placeholder="Search email or name..." className="input w-64" />
            <button className="btn-secondary py-2.5">Search</button>
          </form>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Spend</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.customer_id}>
                    <td className="px-4 py-3"><Link href={`/admin/customers/${customer.customer_id}`} className="link">{customer.first_name} {customer.last_name}</Link><span className="muted block">{customer.email}</span></td>
                    <td className="px-4 py-3">{customer.orders}</td>
                    <td className="px-4 py-3">{formatMoney(toCents(customer.spend))}</td>
                    <td className="px-4 py-3"><Link href={`/admin/customers/${customer.customer_id}`} className="link">Edit →</Link></td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center muted">No customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Add customer</h3>
          <CustomerForm values={{ email: "", first_name: "", last_name: "", phone: null }} />
        </div>
      </div>
    </div>
  );
}
