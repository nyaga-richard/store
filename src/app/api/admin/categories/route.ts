import type { PoolClient } from "pg";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { categorySchema, categoryUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function assertNoCycle(client: PoolClient, categoryId: number, parentId: number | null | undefined) {
  if (!parentId) return;
  if (parentId === categoryId) throw new ApiError("A category cannot be its own parent", 422, "invalid_parent");
  const result = await client.query<{ category_id: number }>(
    `WITH RECURSIVE descendants AS (
       SELECT category_id FROM category WHERE category_id = $1
       UNION ALL
       SELECT c.category_id FROM category c JOIN descendants d ON c.parent_category_id = d.category_id
     )
     SELECT category_id FROM descendants WHERE category_id = $2 LIMIT 1`,
    [categoryId, parentId],
  );
  if (result.rows[0]) throw new ApiError("That parent would create a category cycle", 422, "invalid_parent");
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const input = await parseBody(request, categorySchema);
    const categoryId = await withTransaction(async (client) => {
      if (input.parent_category_id) {
        const parent = await client.query(`SELECT category_id FROM category WHERE category_id = $1`, [input.parent_category_id]);
        if (!parent.rows[0]) throw new ApiError("Parent category not found", 422, "invalid_parent");
      }
      const result = await client.query<{ category_id: number }>(
        `INSERT INTO category (category_name, parent_category_id) VALUES ($1,$2) RETURNING category_id`,
        [input.category_name, input.parent_category_id ?? null],
      );
      return result.rows[0].category_id;
    });
    return ok({ categoryId }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminApi();
    const input = await parseBody(request, categoryUpdateSchema);
    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT category_id FROM category WHERE category_id = $1 FOR UPDATE`, [input.category_id]);
      if (!existing.rows[0]) throw new ApiError("Category not found", 404, "category_not_found");
      if (input.parent_category_id) {
        const parent = await client.query(`SELECT category_id FROM category WHERE category_id = $1`, [input.parent_category_id]);
        if (!parent.rows[0]) throw new ApiError("Parent category not found", 422, "invalid_parent");
      }
      await assertNoCycle(client, input.category_id, input.parent_category_id);
      await client.query(`UPDATE category SET category_name = $2, parent_category_id = $3 WHERE category_id = $1`,
        [input.category_id, input.category_name, input.parent_category_id ?? null]);
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
