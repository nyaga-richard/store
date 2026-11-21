import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await queryOne<{ first_name: string; last_name: string; email: string; phone: string | null }>(
    `SELECT first_name, last_name, email, phone FROM customer WHERE customer_id = $1`, [user.customer_id]);
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold">Profile details</h2>
      <ProfileForm user={profile ?? { ...user, phone: null }} />
    </div>
  );
}
