import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { profileSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, profileSchema);
    await query(
      `UPDATE customer SET first_name = $2, last_name = $3, phone = $4 WHERE customer_id = $1`,
      [user.customer_id, input.first_name, input.last_name, input.phone || null],
    );
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
