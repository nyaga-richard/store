import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { z } from "zod";
import { paymentMethodSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, paymentMethodSchema);
    await withTransaction(async (client) => {
      const type = await client.query<{ payment_type_id: number }>(`SELECT payment_type_id FROM payment_type WHERE type_name = 'Card'`);
      if (!type.rows[0]) throw new ApiError("Payment types are not configured", 500, "configuration_error");
      const count = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM payment_method WHERE customer_id = $1`, [user.customer_id]);
      const isDefault = input.is_default === true || count.rows[0].count === 0;
      if (isDefault) await client.query(`UPDATE payment_method SET is_default = false WHERE customer_id = $1`, [user.customer_id]);
      await client.query(
        `INSERT INTO payment_method (customer_id, payment_type_id, provider, provider_token, card_brand, last_four, expiry_month, expiry_year, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.customer_id, type.rows[0].payment_type_id, getPaymentProvider().name, input.provider_token,
          input.card_brand || null, input.last_four || null, input.expiry_month || null, input.expiry_year || null, isDefault],
      );
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return fail(error);
  }
}

const updateSchema = z.object({ paymentMethodId: z.number().int().positive(), is_default: z.boolean().default(true) });

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, updateSchema);
    await withTransaction(async (client) => {
      const found = await client.query(
        `SELECT 1 FROM payment_method WHERE payment_method_id = $1 AND customer_id = $2`, [input.paymentMethodId, user.customer_id]);
      if (!found.rows[0]) throw new ApiError("Payment method not found", 404, "payment_method_not_found");
      await client.query(`UPDATE payment_method SET is_default = false WHERE customer_id = $1`, [user.customer_id]);
      await client.query(`UPDATE payment_method SET is_default = true WHERE payment_method_id = $1`, [input.paymentMethodId]);
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

const deleteSchema = z.object({ paymentMethodId: z.number().int().positive() });

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in", 401, "unauthorized");
    const input = await parseBody(request, deleteSchema);
    await query(`DELETE FROM payment_method WHERE payment_method_id = $1 AND customer_id = $2`, [input.paymentMethodId, user.customer_id]);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
