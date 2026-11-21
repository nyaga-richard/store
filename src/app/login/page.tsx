import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/account");
  const { next } = await searchParams;
  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="muted mt-1 mb-6">Sign in to check out faster and track your orders.</p>
        <AuthForm mode="login" next={next} />
        <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Demo account: <strong>demo@trustedsystems.co.ke</strong> / <strong>Demo123!</strong>
        </div>
      </div>
    </div>
  );
}
