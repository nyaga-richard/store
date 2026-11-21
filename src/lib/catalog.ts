import "server-only";
import { query, queryOne } from "./db";
import { toCents } from "./money";
import type { CategoryNode, ProductDetail, ProductListItem, ProductOption, ProductVariantView, Review } from "./types";

/**
 * Best active promotion per variant, evaluated entirely in PostgreSQL.
 * Percentage and Fixed discounts are both exact numeric arithmetic.
 */
/** The same primary image rule is used by the catalogue, cart and order review. */
export const PRIMARY_IMAGE_SQL = `
  (SELECT pi.image_url FROM product_image pi
   WHERE pi.product_id = p.product_id
   ORDER BY (pi.variant_id IS NOT NULL), pi.sort_order, pi.image_id LIMIT 1)`;

export const EFFECTIVE_CENTS = `
  ROUND(GREATEST(0::numeric, v.price * 100 - COALESCE((
    SELECT MAX(CASE
      WHEN pr.discount_type ILIKE 'Percentage'
        THEN LEAST(ROUND(v.price * pr.discount_value), v.price * 100)
      ELSE LEAST(pr.discount_value * 100, v.price * 100)
    END)
    FROM promotion_product pp
    JOIN promotion pr ON pr.promotion_id = pp.promotion_id
    WHERE pp.product_id = p.product_id
      AND pr.start_date <= now() AND pr.end_date >= now()
  ), 0::numeric)))
`;

export async function getCategoryTree(): Promise<CategoryNode[]> {
  return query<CategoryNode>(`
    SELECT c.category_id, c.category_name, c.parent_category_id,
           (SELECT COUNT(*)::int FROM product_category pc WHERE pc.category_id = c.category_id) AS product_count
    FROM category c
    ORDER BY c.parent_category_id NULLS FIRST, c.category_name
  `);
}

export function descendantCategoryIds(categories: CategoryNode[], rootId: number): number[] {
  const ids = [rootId];
  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      if (category.parent_category_id && ids.includes(category.parent_category_id) && !ids.includes(category.category_id)) {
        ids.push(category.category_id);
        added = true;
      }
    }
  }
  return ids;
}

interface ListArgs {
  categoryId?: number;
  search?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "name";
  page?: number;
  limit?: number;
}

export async function listProducts({
  categoryId, search, sort = "newest", page = 1, limit = 24,
}: ListArgs = {}): Promise<{ items: ProductListItem[]; total: number; page: number; pages: number }> {
  const categoryIds = categoryId ? descendantCategoryIds(await getCategoryTree(), categoryId) : [];
  const params: unknown[] = [categoryIds, `%${search ?? ""}%`, limit, (page - 1) * limit];
  const order =
    sort === "price-asc" ? "vs.effective_cents ASC, p.product_name ASC" :
    sort === "price-desc" ? "vs.effective_cents DESC, p.product_name ASC" :
    sort === "name" ? "p.product_name ASC" :
    "p.created_at DESC, p.product_id DESC";

  const rows = await query<{
    product_id: number; product_name: string; brand: string | null; description: string | null;
    min_price: string; effective_cents: string; variant_count: number; image_url: string | null;
    category_ids: number[] | null;
  }>(
    `SELECT p.product_id, p.product_name, p.brand, p.description,
            vs.min_price::text, vs.effective_cents::text, vs.variant_count,
            img.image_url,
            (SELECT COALESCE(array_agg(pc.category_id ORDER BY pc.category_id), '{}'::int[]) FROM product_category pc WHERE pc.product_id = p.product_id) AS category_ids
     FROM product p
     JOIN LATERAL (
       SELECT MIN(v.price) AS min_price, MIN(${EFFECTIVE_CENTS}) AS effective_cents, COUNT(*)::int AS variant_count
       FROM product_variant v WHERE v.product_id = p.product_id
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT pi.image_url FROM product_image pi
       WHERE pi.product_id = p.product_id
       ORDER BY (pi.variant_id IS NOT NULL), pi.sort_order, pi.image_id LIMIT 1
     ) img ON true
     WHERE ($1::int[] IS NULL OR cardinality($1::int[]) = 0 OR EXISTS (
         SELECT 1 FROM product_category pc WHERE pc.product_id = p.product_id AND pc.category_id = ANY($1::int[])
       ))
       AND p.is_active = true
       AND ($2 = '' OR p.product_name ILIKE $2 OR p.brand ILIKE $2 OR p.description ILIKE $2)
     ORDER BY ${order}
     LIMIT $3 OFFSET $4`,
    params,
  );

  const count = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM product p
     WHERE ($1::int[] IS NULL OR cardinality($1::int[]) = 0 OR EXISTS (
         SELECT 1 FROM product_category pc WHERE pc.product_id = p.product_id AND pc.category_id = ANY($1::int[])
       ))
       AND p.is_active = true
       AND ($2 = '' OR p.product_name ILIKE $2 OR p.brand ILIKE $2 OR p.description ILIKE $2)`,
    [categoryIds, `%${search ?? ""}%`],
  );

  const items = rows.map((row) => {
    const price_cents = toCents(row.min_price);
    const effective_cents = Number(row.effective_cents);
    return {
      ...row,
      price_cents,
      effective_cents,
      discount_percent: price_cents > 0 ? Math.round(((price_cents - effective_cents) * 100) / price_cents) : 0,
      category_ids: row.category_ids ?? [],
    } satisfies ProductListItem;
  });

  const total = count?.total ?? 0;
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProduct(productId: number): Promise<ProductDetail | null> {
  const product = await queryOne<{
    product_id: number; product_name: string; brand: string | null; description: string | null;
    min_price: string; effective_cents: string; variant_count: number; image_url: string | null;
    created_at: string;
  }>(
    `SELECT p.product_id, p.product_name, p.brand, p.description, p.created_at::text,
            vs.min_price::text, vs.effective_cents::text, vs.variant_count, img.image_url
     FROM product p
     JOIN LATERAL (
       SELECT MIN(v.price) AS min_price, MIN(${EFFECTIVE_CENTS}) AS effective_cents, COUNT(*)::int AS variant_count
       FROM product_variant v WHERE v.product_id = p.product_id
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT pi.image_url FROM product_image pi WHERE pi.product_id = p.product_id
       ORDER BY (pi.variant_id IS NOT NULL), pi.sort_order, pi.image_id LIMIT 1
     ) img ON true
     WHERE p.product_id = $1 AND p.is_active = true`,
    [productId],
  );
  if (!product) return null;

  const price_cents = toCents(product.min_price);
  const effective_cents = Number(product.effective_cents);

  const [images, options, variantRows, mappingRows, reviewRows] = await Promise.all([
    query<{ image_id: number; variant_id: number | null; image_url: string; sort_order: number }>(
      `SELECT image_id, variant_id, image_url, sort_order FROM product_image
       WHERE product_id = $1 ORDER BY sort_order, image_id`, [productId]),
    query<{ option_id: number; option_name: string; option_value_id: number | null; value_name: string | null }>(
      `SELECT po.option_id, po.option_name, pov.option_value_id, pov.value_name
       FROM product_option po
       LEFT JOIN product_option_value pov ON pov.option_id = po.option_id
       WHERE po.product_id = $1 ORDER BY po.option_id, pov.option_value_id`, [productId]),
    query<{
      variant_id: number; sku: string; price: string; qty_in_stock: number;
      effective_cents: string; option_summary: string | null; image_url: string | null;
    }>(
      `SELECT v.variant_id, v.sku, v.price::text, v.qty_in_stock,
              ${EFFECTIVE_CENTS}::text AS effective_cents,
              (SELECT string_agg(pov.value_name, ' / ' ORDER BY po.option_name)
               FROM variant_option_value vov
               JOIN product_option po ON po.option_id = vov.option_id
               JOIN product_option_value pov ON pov.option_value_id = vov.option_value_id
               WHERE vov.variant_id = v.variant_id) AS option_summary,
              (SELECT pi.image_url FROM product_image pi
               WHERE pi.variant_id = v.variant_id OR (pi.variant_id IS NULL AND NOT EXISTS (
                   SELECT 1 FROM product_image p2 WHERE p2.variant_id = v.variant_id))
               ORDER BY (pi.variant_id IS NULL), pi.sort_order, pi.image_id LIMIT 1) AS image_url
       FROM product_variant v
       JOIN product p ON p.product_id = v.product_id
       WHERE v.product_id = $1 ORDER BY v.variant_id`, [productId]),
    query<{ variant_id: number; option_id: number; option_value_id: number }>(
      `SELECT vov.variant_id, vov.option_id, vov.option_value_id
       FROM variant_option_value vov JOIN product_variant v ON v.variant_id = vov.variant_id
       WHERE v.product_id = $1`, [productId]),
    query<Review>(
      `SELECT r.review_id, r.rating, r.comment, r.created_at::text,
              CONCAT_WS(' ', c.first_name, LEFT(c.last_name, 1) || '.') AS reviewer,
              NULL::text AS product_name
       FROM review r
       JOIN order_line ol ON ol.order_line_id = r.order_line_id
       JOIN customer_order o ON o.order_id = ol.order_id
       JOIN customer c ON c.customer_id = o.customer_id
       JOIN product_variant v ON v.variant_id = ol.variant_id
       WHERE v.product_id = $1 AND o.order_status_id <> 1
       ORDER BY r.created_at DESC LIMIT 50`, [productId]),
  ]);

  const optionMap = new Map<number, ProductOption>();
  for (const row of options) {
    let option = optionMap.get(row.option_id);
    if (!option) {
      option = { option_id: row.option_id, option_name: row.option_name, values: [] };
      optionMap.set(row.option_id, option);
    }
    if (row.option_value_id && row.value_name) option.values.push({ option_value_id: row.option_value_id, value_name: row.value_name });
  }

  const variants: ProductVariantView[] = variantRows.map((row) => ({
    variant_id: row.variant_id,
    sku: row.sku,
    price_cents: toCents(row.price),
    effective_cents: Number(row.effective_cents),
    qty_in_stock: row.qty_in_stock,
    option_summary: row.option_summary,
    image_url: row.image_url,
    selections: mappingRows.filter((m) => m.variant_id === row.variant_id).map((m) => ({ optionId: m.option_id, valueId: m.option_value_id })),
  }));

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    brand: product.brand,
    description: product.description,
    image_url: product.image_url,
    price_cents,
    effective_cents,
    discount_percent: price_cents > 0 ? Math.round(((price_cents - effective_cents) * 100) / price_cents) : 0,
    variant_count: product.variant_count,
    category_ids: [],
    created_at: product.created_at,
    images,
    options: [...optionMap.values()],
    variants,
    reviews: reviewRows,
    rating_avg: reviewRows.length ? Math.round((reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length) * 10) / 10 : 0,
  };
}

export async function getFeaturedProducts(limit = 8): Promise<ProductListItem[]> {
  const { items } = await listProducts({ limit, sort: "newest" });
  return items;
}
