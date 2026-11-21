import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { toCents, toDecimal } from "@/lib/money";
import { adminProductSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) throw new ApiError("Invalid product", 400);
    const input = await parseBody(request, adminProductSchema);

    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT product_id FROM product WHERE product_id = $1 FOR UPDATE`, [productId]);
      if (!existing.rows[0]) throw new ApiError("Product not found", 404, "product_not_found");

      await client.query(
        `UPDATE product SET product_name = $2, description = $3, brand = $4 WHERE product_id = $1`,
        [productId, input.product_name, input.description || null, input.brand || null],
      );

      const categoryIds = [...new Set(input.categoryIds ?? [])];
      await client.query(`DELETE FROM product_category WHERE product_id = $1`, [productId]);
      for (const categoryId of categoryIds) {
        const category = await client.query(`SELECT category_id FROM category WHERE category_id = $1`, [categoryId]);
        if (!category.rows[0]) throw new ApiError(`Unknown category ${categoryId}`, 422, "invalid_category");
        await client.query(`INSERT INTO product_category (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [productId, categoryId]);
      }

      for (const variant of input.variants ?? []) {
        const result = await client.query(
          `UPDATE product_variant SET price = $2, qty_in_stock = $3 WHERE variant_id = $1 AND product_id = $4`,
          [variant.variant_id, toDecimal(toCents(variant.price)), variant.qty_in_stock, productId],
        );
        if (result.rowCount !== 1) throw new ApiError("Variant does not belong to this product", 422, "invalid_variant");
      }
    });

    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
