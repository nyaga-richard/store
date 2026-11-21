import "server-only";
import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { getCurrentUser } from "./auth";
import type { StaffRole } from "./staff";
import { getCurrentStaff } from "./staff";

export interface BackofficeUser {
  kind: "staff" | "customer";
  email: string;
  displayName: string;
  role: StaffRole;
  staffId?: number;
  customerId?: number;
}

/** Customer emails listed in ADMIN_EMAILS remain valid backoffice owners. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function getBackofficeUser(): Promise<BackofficeUser | null> {
  const staff = await getCurrentStaff();
  if (staff) {
    return {
      kind: "staff",
      email: staff.email,
      displayName: `${staff.first_name} ${staff.last_name}`,
      role: staff.role,
      staffId: staff.staff_id,
    };
  }
  const customer = await getCurrentUser();
  if (customer && adminEmails().includes(customer.email.toLowerCase())) {
    return {
      kind: "customer",
      email: customer.email,
      displayName: `${customer.first_name} ${customer.last_name}`,
      role: "owner",
      customerId: customer.customer_id,
    };
  }
  return null;
}

export async function requireAdmin(): Promise<BackofficeUser> {
  const user = await getBackofficeUser();
  if (!user) redirect("/staff/login?next=/admin");
  return user;
}

export async function requireAdminApi(): Promise<BackofficeUser> {
  const user = await getBackofficeUser();
  if (!user) throw new ApiError("Backoffice sign-in required (/staff/login)", 401, "unauthorized");
  return user;
}

export async function requireRole(...roles: StaffRole[]): Promise<BackofficeUser> {
  const user = await requireAdminApi();
  if (!roles.includes(user.role)) throw new ApiError("Your role cannot perform this action", 403, "forbidden");
  return user;
}
