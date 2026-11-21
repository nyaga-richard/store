import { requireUser } from "@/lib/auth";
import { AccountNav } from "@/components/AccountNav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-page py-10">
      <h1 className="section-title mb-6">My account</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <AccountNav name={`${user.first_name} ${user.last_name}`} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
