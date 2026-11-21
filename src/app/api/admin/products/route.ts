import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { toCents, toDecimal } from "@/lib/money";
import { productCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const input = await parseBody(request, productCreateSchema);
    const productId = await withTransaction(async (client) => {
      const product = await client.query<{ product_id: number }>(
        `INSERT INTO product (product_name, description, brand, is_active, created_at)
         VALUES ($1,$2,$3,$4,now()) RETURNING product_id`,
        [input.product_name, input.description || null, input.brand || null, input.is_active ?? true],
      );
      const id = product.rows[0].product_id;
      for (const categoryId of [...new Set(input.categoryIds ?? [])]) {
        const category = await client.query(`SELECT 1 FROM category WHERE category_id = $1`, [categoryId]);
        if (!category.rows[0]) throw new ApiError(`Unknown category ${categoryId}`, 422, "invalid_category");
        await client.query(`INSERT INTO product_category (product_id, category_id) VALUES ($1,$2)`, [id, categoryId]);
      }
      await client.query(
        `INSERT INTO product_variant (product_id, sku, price, qty_in_stock) VALUES ($1,$2,$3,$4)`,
        [id, input.sku, toDecimal(toCents(input.price)), input.qty_in_stock],
      );
      if (input.image_url) {
        await client.query(`INSERT INTO product_image (product_id, variant_id, image_url, sort_order) VALUES ($1,NULL,$2,1)`, [id, input.image_url]);
      }
      return id;
    });
    return ok({ productId }, 201);
  } catch (error) {
    return fail(error);
  }
}
