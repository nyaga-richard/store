import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { addToCart, clearCart, getCart, updateCartLine } from "@/lib/cart";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ cart: await getCart(await getCurrentUser()) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, cartAddSchema);
    await addToCart(await getCurrentUser(), input.variantId, input.quantity ?? 1);
    return ok({ cart: await getCart(await getCurrentUser()) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await parseBody(request, cartUpdateSchema);
    await updateCartLine(await getCurrentUser(), input.variantId, input.quantity ?? 1);
    return ok({ cart: await getCart(await getCurrentUser()) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json().catch(() => null);
    const parsed = z.object({ variantId: z.number().int().positive() }).safeParse(body);
    if (parsed.success) {
      await updateCartLine(user, parsed.data.variantId, 0);
      return ok({ cart: await getCart(user) });
    }
    await clearCart(user);
    return ok({ cart: await getCart(await getCurrentUser()) });
  } catch (error) {
    return fail(error);
  }
}
