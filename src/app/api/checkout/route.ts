import { ApiError, fail, idempotencyKey, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { checkout } from "@/lib/checkout";
import { checkoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in to check out", 401, "unauthorized");
    const input = await parseBody(request, checkoutSchema);
    const key = idempotencyKey(request, input);
    const result = await checkout(user, input, key);
    return ok(result, result.status === "failed" ? 402 : 200);
  } catch (error) {
    return fail(error);
  }
}
