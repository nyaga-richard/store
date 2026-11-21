import "server-only";
import { query, queryOne } from "./db";
import { toCents, toDecimal } from "./money";

export interface AdminStats {
  orders: number;
  paidOrders: number;
  revenue_cents: number;
  customers: number;
  products: number;
  lowStock: number;
  activePromotions: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const stats = await queryOne<{
    orders: number; paid_orders: number; revenue: string | null; customers: number;
    products: number; low_stock: number; active_promotions: number;
  }>(
    `SELECT (SELECT COUNT(*)::int FROM customer_order WHERE order_status_id <> 1) AS orders,
            (SELECT COUNT(*)::int FROM customer_order WHERE order_status_id IN (3,4,5)) AS paid_orders,
            (SELECT COALESCE(SUM(order_total),0)::text FROM customer_order WHERE order_status_id IN (2,3,4,5)) AS revenue,
            (SELECT COUNT(*)::int FROM customer) AS customers,
            (SELECT COUNT(*)::int FROM product) AS products,
            (SELECT COUNT(*)::int FROM product_variant WHERE qty_in_stock < 5) AS low_stock,
            (SELECT COUNT(*)::int FROM promotion WHERE start_date <= now() AND end_date >= now()) AS active_promotions`,
  );
  return {
    orders: stats?.orders ?? 0,
    paidOrders: stats?.paid_orders ?? 0,
    revenue_cents: toCents(stats?.revenue ?? "0"),
    customers: stats?.customers ?? 0,
    products: stats?.products ?? 0,
    lowStock: stats?.low_stock ?? 0,
    activePromotions: stats?.active_promotions ?? 0,
  };
}

export interface AdminProduct {
  product_id: number;
  product_name: string;
  brand: string | null;
  is_active: boolean;
  created_at: string;
  variant_count: number;
  min_price: string;
  stock: number;
  category_ids: number[];
  image_url: string | null;
}

export async function listAdminProducts(search = ""): Promise<AdminProduct[]> {
  const rows = await query<AdminProduct>(
    `SELECT p.product_id, p.product_name, p.brand, p.is_active, p.created_at::text,
            COUNT(v.variant_id)::int AS variant_count,
            COALESCE(MIN(v.price),0)::text AS min_price,
            COALESCE(SUM(v.qty_in_stock),0)::int AS stock,
            COALESCE((SELECT array_agg(pc.category_id) FROM product_category pc WHERE pc.product_id = p.product_id), '{}'::int[]) AS category_ids,
            (SELECT pi.image_url FROM product_image pi WHERE pi.product_id = p.product_id ORDER BY pi.sort_order, pi.image_id LIMIT 1) AS image_url
     FROM product p LEFT JOIN product_variant v ON v.product_id = p.product_id
     WHERE $1 = '' OR p.product_name ILIKE $1 OR p.brand ILIKE $1
     GROUP BY p.product_id ORDER BY p.product_id DESC`,
    [`%${search}%`],
  );
  return rows;
}

type AdminVariant = { variant_id: number; sku: string; price: string; qty_in_stock: number; option_summary: string | null };

export interface AdminProductDetail extends AdminProduct {
  description: string | null;
  variants: AdminVariant[];
}

export async function getAdminProduct(productId: number): Promise<AdminProductDetail | null> {
  const base = (await query<AdminProductDetail>(
    `SELECT p.product_id, p.product_name, p.description, p.brand, p.created_at::text,
            COALESCE((SELECT array_agg(pc.category_id) FROM product_category pc WHERE pc.product_id = p.product_id), '{}'::int[]) AS category_ids,
            (SELECT pi.image_url FROM product_image pi WHERE pi.product_id = p.product_id ORDER BY pi.sort_order, pi.image_id LIMIT 1) AS image_url
     FROM product p WHERE p.product_id = $1`, [productId]))[0];
  if (!base) return null;
  const variants = await query<AdminVariant>(
    `SELECT v.variant_id, v.sku, v.price::text, v.qty_in_stock,
            (SELECT string_agg(pov.value_name, ' / ' ORDER BY po.option_name)
             FROM variant_option_value vov
             JOIN product_option po ON po.option_id = vov.option_id
             JOIN product_option_value pov ON pov.option_value_id = vov.option_value_id
             WHERE vov.variant_id = v.variant_id) AS option_summary
     FROM product_variant v WHERE v.product_id = $1 ORDER BY v.variant_id`, [productId]);
  const minCents = variants.reduce((min, variant) => Math.min(min, toCents(variant.price)), Number.MAX_SAFE_INTEGER);
  return {
    ...base,
    variants,
    variant_count: variants.length,
    min_price: variants.length ? toDecimal(minCents) : "0.00",
    stock: variants.reduce((sum, variant) => sum + variant.qty_in_stock, 0),
  };
}

export interface AdminOrder {
  order_id: number;
  customer_id: number;
  customer_name: string;
  email: string;
  status_name: string;
  order_status_id: number;
  order_total: string;
  item_count: number;
  created_at: string;
  payment_status: string | null;
}

export async function listAdminOrders(statusId?: number): Promise<AdminOrder[]> {
  return query<AdminOrder>(
    `SELECT o.order_id, o.customer_id, CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.email,
            os.status_name, os.order_status_id, COALESCE(o.order_total,0)::text AS order_total,
            (SELECT COUNT(*)::int FROM order_line ol WHERE ol.order_id = o.order_id) AS item_count,
            o.created_at::text,
            (SELECT p.payment_status FROM payment p WHERE p.order_id = o.order_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_status
     FROM customer_order o
     JOIN customer c ON c.customer_id = o.customer_id
     JOIN order_status os ON os.order_status_id = o.order_status_id
     WHERE o.order_status_id <> 1 AND ($1::int IS NULL OR o.order_status_id = $1)
     ORDER BY o.order_id DESC LIMIT 200`,
    [statusId ?? null],
  );
}

export interface AdminPromotion {
  promotion_id: number;
  promotion_name: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  start_date: string;
  end_date: string;
  product_count: number;
  active: boolean;
}

export async function listAdminPromotions(): Promise<AdminPromotion[]> {
  return query<AdminPromotion>(
    `SELECT pr.promotion_id, pr.promotion_name, pr.description, pr.discount_type, pr.discount_value::text,
            pr.start_date::text, pr.end_date::text,
            (SELECT COUNT(*)::int FROM promotion_product pp WHERE pp.promotion_id = pr.promotion_id) AS product_count,
            (pr.start_date <= now() AND pr.end_date >= now()) AS active
     FROM promotion pr ORDER BY pr.promotion_id DESC`,
  );
}

export async function listAdminCategories() {
  return query<{ category_id: number; category_name: string; parent_category_id: number | null; product_count: number }>(
    `SELECT c.category_id, c.category_name, c.parent_category_id,
            (SELECT COUNT(*)::int FROM product_category pc WHERE pc.category_id = c.category_id) AS product_count
     FROM category c ORDER BY c.parent_category_id NULLS FIRST, c.category_name`,
  );
}

export async function listAdminCustomers(search = "") {
  return query<{
    customer_id: number; email: string; first_name: string; last_name: string; phone: string | null;
    created_at: string; orders: number; spend: string;
  }>(
    `SELECT c.customer_id, c.email, c.first_name, c.last_name, c.phone, c.created_at::text,
            (SELECT COUNT(*)::int FROM customer_order o WHERE o.customer_id = c.customer_id AND o.order_status_id <> 1) AS orders,
            (SELECT COALESCE(SUM(o.order_total),0)::text FROM customer_order o
             WHERE o.customer_id = c.customer_id AND o.order_status_id IN (2,3,4,5)) AS spend
     FROM customer c
     WHERE $1 = '' OR c.email ILIKE $1 OR c.first_name ILIKE $1 OR c.last_name ILIKE $1
     ORDER BY c.customer_id DESC`,
    [`%${search}%`],
  );
}

export async function listPurchaseOrders() {
  return query<{
    purchase_order_id: number; order_number: string; supplier_name: string; status: string;
    order_date: string; expected_date: string | null; subtotal: string; line_count: number;
  }>(
    `SELECT po.purchase_order_id, po.order_number, s.supplier_name, po.status, po.order_date::text,
            po.expected_date::text, po.subtotal::text,
            (SELECT COUNT(*)::int FROM purchase_order_line pol WHERE pol.purchase_order_id = po.purchase_order_id) AS line_count
     FROM purchase_order po JOIN supplier s ON s.supplier_id = po.supplier_id
     ORDER BY po.purchase_order_id DESC LIMIT 200`,
  );
}

export interface PurchaseDetail {
  purchase_order_id: number;
  order_number: string;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_date: string | null;
  subtotal: string;
  notes: string | null;
  lines: {
    purchase_order_line_id: number; variant_id: number; sku: string; product_name: string;
    quantity: number; unit_cost: string; received_quantity: number;
  }[];
}

export async function getPurchaseOrder(id: number): Promise<PurchaseDetail | null> {
  const order = (await query<PurchaseDetail>(
    `SELECT po.purchase_order_id, po.order_number, s.supplier_name, po.status, po.order_date::text,
            po.expected_date::text, po.subtotal::text, po.notes
     FROM purchase_order po JOIN supplier s ON s.supplier_id = po.supplier_id
     WHERE po.purchase_order_id = $1`, [id]))[0];
  if (!order) return null;
  order.lines = await query<PurchaseDetail["lines"][number]>(
    `SELECT pol.purchase_order_line_id, pol.variant_id, v.sku, p.product_name, pol.quantity,
            pol.unit_cost::text, pol.received_quantity
     FROM purchase_order_line pol
     JOIN product_variant v ON v.variant_id = pol.variant_id
     JOIN product p ON p.product_id = v.product_id
     WHERE pol.purchase_order_id = $1 ORDER BY pol.purchase_order_line_id`, [id]);
  return order;
}
