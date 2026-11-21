import { NextResponse } from "next/server";
import { z } from "zod";
import type { PoolClient } from "pg";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { promotionSchema, promotionUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function verifyProducts(client: PoolClient, productIds: number[]) {
  for (const productId of productIds) {
    const result = await client.query(`SELECT product_id FROM product WHERE product_id = $1`, [productId]);
    if (!result.rows[0]) throw new ApiError(`Unknown product ${productId}`, 422, "invalid_product");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const input = await parseBody(request, promotionSchema);
    const promotionId = await withTransaction(async (client) => {
      await verifyProducts(client, input.productIds);
      const result = await client.query<{ promotion_id: number }>(
        `INSERT INTO promotion (promotion_name, description, discount_type, discount_value, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING promotion_id`,
        [input.promotion_name, input.description || null, input.discount_type, input.discount_value,
          new Date(input.start_date), new Date(input.end_date)],
      );
      const id = result.rows[0].promotion_id;
      for (const productId of input.productIds) {
        await client.query(`INSERT INTO promotion_product (promotion_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, productId]);
      }
      return id;
    });
    return ok({ promotionId }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminApi();
    const input = await parseBody(request, promotionUpdateSchema);
    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT promotion_id FROM promotion WHERE promotion_id = $1 FOR UPDATE`, [input.promotion_id]);
      if (!existing.rows[0]) throw new ApiError("Promotion not found", 404, "promotion_not_found");
      await client.query(
        `UPDATE promotion SET promotion_name = COALESCE($2, promotion_name), description = $3,
                discount_type = COALESCE($4, discount_type), discount_value = COALESCE($5, discount_value),
                start_date = COALESCE($6, start_date), end_date = COALESCE($7, end_date)
         WHERE promotion_id = $1`,
        [input.promotion_id, input.promotion_name ?? null, input.description ?? null, input.discount_type ?? null,
          input.discount_value ?? null, input.start_date ? new Date(input.start_date) : null, input.end_date ? new Date(input.end_date) : null],
      );
      if (input.productIds) {
        await verifyProducts(client, input.productIds);
        await client.query(`DELETE FROM promotion_product WHERE promotion_id = $1`, [input.promotion_id]);
        for (const productId of input.productIds) {
          await client.query(`INSERT INTO promotion_product (promotion_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [input.promotion_id, productId]);
        }
      }
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

const deleteSchema = z.object({ promotion_id: z.number().int().positive() });

export async function DELETE(request: Request) {
  try {
    await requireAdminApi();
    const input = await parseBody(request, deleteSchema);
    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT promotion_id FROM promotion WHERE promotion_id = $1 FOR UPDATE`, [input.promotion_id]);
      if (!existing.rows[0]) throw new ApiError("Promotion not found", 404, "promotion_not_found");
      await client.query(`DELETE FROM promotion_product WHERE promotion_id = $1`, [input.promotion_id]);
      await client.query(`DELETE FROM promotion WHERE promotion_id = $1`, [input.promotion_id]);
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
