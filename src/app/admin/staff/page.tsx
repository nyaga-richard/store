import { getBackofficeUser } from "@/lib/admin";
import { query } from "@/lib/db";
import { StaffManager } from "@/components/StaffManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff & roles" };

export default async function AdminStaffPage() {
  const user = await getBackofficeUser();
  const staff = await query<{
    staff_id: number; email: string; first_name: string; last_name: string;
    role: string; is_active: boolean; created_at: string;
  }>(`SELECT staff_id, email, first_name, last_name, role, is_active, created_at::text FROM staff_user ORDER BY staff_id`);
  const canManage = user?.role === "owner" || user?.role === "admin";
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Staff & roles</h2><p className="muted">Owner and admin can create staff; only an owner can delete accounts or grant owner role.</p></div>
      <StaffManager staff={staff} canManage={canManage} canDelete={user?.role === "owner"} />
    </div>
  );
}
