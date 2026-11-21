import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireAdminApi, requireRole } from "@/lib/admin";
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
        `UPDATE product SET product_name = $2, description = $3, brand = $4, is_active = COALESCE($5, is_active)
         WHERE product_id = $1`,
        [productId, input.product_name, input.description || null, input.brand || null, input.is_active ?? null],
      );

      if (input.image_url) {
        const updated = await client.query(`UPDATE product_image SET image_url = $2 WHERE product_id = $1 AND variant_id IS NULL`, [productId, input.image_url]);
        if (updated.rowCount === 0) {
          await client.query(`INSERT INTO product_image (product_id, variant_id, image_url, sort_order) VALUES ($1,NULL,$2,1)`, [productId, input.image_url]);
        }
      }

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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("owner", "admin");
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) throw new ApiError("Invalid product", 400);

    await withTransaction(async (client) => {
      const product = await client.query(`SELECT product_id FROM product WHERE product_id = $1 FOR UPDATE`, [productId]);
      if (!product.rows[0]) throw new ApiError("Product not found", 404, "product_not_found");
      const sold = await client.query(
        `SELECT 1 FROM order_line ol JOIN product_variant v ON v.variant_id = ol.variant_id
         WHERE v.product_id = $1 AND ol.order_id IN (SELECT order_id FROM customer_order WHERE order_status_id <> 1) LIMIT 1`,
        [productId],
      );
      if (sold.rows[0]) {
        throw new ApiError("This product has order history. Unpublish it instead of deleting it.", 409, "product_has_history");
      }
      const variants = await client.query<{ variant_id: number }>(`SELECT variant_id FROM product_variant WHERE product_id = $1`, [productId]);
      const variantIds = variants.rows.map((row) => row.variant_id);
      if (variantIds.length) {
        await client.query(`DELETE FROM order_line WHERE variant_id = ANY($1::int[])`, [variantIds]);
        await client.query(`DELETE FROM variant_option_value WHERE variant_id = ANY($1::int[])`, [variantIds]);
        await client.query(`DELETE FROM purchase_order_line WHERE variant_id = ANY($1::int[])`, [variantIds]);
        await client.query(`DELETE FROM product_image WHERE variant_id = ANY($1::int[])`, [variantIds]);
        await client.query(`DELETE FROM product_variant WHERE product_id = $1`, [productId]);
      }
      const options = await client.query<{ option_id: number }>(`SELECT option_id FROM product_option WHERE product_id = $1`, [productId]);
      for (const option of options.rows) {
        await client.query(`DELETE FROM product_option_value WHERE option_id = $1`, [option.option_id]);
      }
      await client.query(`DELETE FROM product_option WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM product_image WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM product_category WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM promotion_product WHERE product_id = $1`, [productId]);
      await client.query(`DELETE FROM product WHERE product_id = $1`, [productId]);
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
