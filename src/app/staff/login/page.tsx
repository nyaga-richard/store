import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/components/StaffLoginForm";
import { getBackofficeUser } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff sign in" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getBackofficeUser()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Staff sign in</h1>
        <p className="muted mt-1 mb-6">Manage products, orders, customers, suppliers and purchases.</p>
        <StaffLoginForm next={next} />
      </div>
    </div>
  );
}
