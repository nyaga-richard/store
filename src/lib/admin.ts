import "server-only";
import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { getCurrentUser, type SessionUser } from "./auth";

/** Admin access = an existing customer whose email is on the env allowlist.
 *  The supplied PostgreSQL schema has no role column, so no schema change is needed. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) redirect(user ? "/account" : "/login?next=/admin");
  return user;
}

export async function requireAdminApi(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
  if (!isAdmin(user)) throw new ApiError("Admin access required", 403, "forbidden");
  return user;
}
