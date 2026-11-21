import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="muted mt-1 mb-6">Fast checkout, saved addresses and verified purchase reviews.</p>
        <AuthForm mode="register" />
      </div>
    </div>
  );
}
