import "server-only";
import { EFFECTIVE_CENTS, PRIMARY_IMAGE_SQL } from "./catalog";
import { readGuestCart, writeGuestCart, clearGuestCart, type GuestCartLine } from "./cart-cookie";
import { query, queryOne, withTransaction } from "./db";
import { ApiError } from "./api";
import { toCents, toDecimal } from "./money";
import type { CartLine, CartView } from "./types";
import type { SessionUser } from "./auth";
import type { PoolClient } from "pg";

interface SnapshotRow {
  variant_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  option_summary: string | null;
  price: string;
  qty_in_stock: number;
  effective_cents: string;
  image_url: string | null;
  is_active: boolean;
}

/** Current, promotion-adjusted price for one variant. */
export async function getVariantSnapshot(variantId: number): Promise<SnapshotRow | null> {
  return queryOne<SnapshotRow>(
    `SELECT v.variant_id, v.product_id, v.sku, p.product_name, p.is_active, v.price::text,
            v.qty_in_stock, ${EFFECTIVE_CENTS}::text AS effective_cents,
            (SELECT string_agg(pov.value_name, ' / ' ORDER BY po.option_name)
             FROM variant_option_value vov
             JOIN product_option po ON po.option_id = vov.option_id
             JOIN product_option_value pov ON pov.option_value_id = vov.option_value_id
             WHERE vov.variant_id = v.variant_id) AS option_summary,
            ${PRIMARY_IMAGE_SQL} AS image_url
     FROM product_variant v JOIN product p ON p.product_id = v.product_id
     WHERE v.variant_id = $1`,
    [variantId],
  );
}

async function snapshotRows(variantIds: number[]): Promise<SnapshotRow[]> {
  if (!variantIds.length) return [];
  const rows: SnapshotRow[] = [];
  // Chunked so the parameter list stays inside PostgreSQL's bind limit.
  for (let i = 0; i < variantIds.length; i += 200) {
    const chunk = variantIds.slice(i, i + 200);
    rows.push(...await query<SnapshotRow>(
      `SELECT v.variant_id, v.product_id, v.sku, p.product_name, p.is_active, v.price::text,
              v.qty_in_stock, ${EFFECTIVE_CENTS}::text AS effective_cents,
              (SELECT string_agg(pov.value_name, ' / ' ORDER BY po.option_name)
               FROM variant_option_value vov
               JOIN product_option po ON po.option_id = vov.option_id
               JOIN product_option_value pov ON pov.option_value_id = vov.option_value_id
               WHERE vov.variant_id = v.variant_id) AS option_summary,
              ${PRIMARY_IMAGE_SQL} AS image_url
       FROM product_variant v JOIN product p ON p.product_id = v.product_id
       WHERE v.variant_id = ANY($1::int[])`,
      [chunk],
    ));
  }
  const byId = new Map(rows.map((row) => [row.variant_id, row]));
  return variantIds.map((id) => byId.get(id)).filter((row): row is SnapshotRow => Boolean(row));
}

function toCartLine(row: SnapshotRow, quantity: number, orderLineId: number | null): CartLine {
  const unit = Number(row.effective_cents);
  return {
    order_line_id: orderLineId,
    variant_id: row.variant_id,
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku,
    option_summary: row.option_summary,
    image_url: row.image_url,
    quantity,
    unit_price_cents: unit,
    discount_cents: Math.max(0, toCents(row.price) - unit),
    line_total_cents: unit * quantity,
    available: row.qty_in_stock,
    is_active: row.is_active,
  };
}

export async function getCart(user: SessionUser | null): Promise<CartView> {
  let lines: CartLine[] = [];
  if (user) {
    const rows = await query<{ variant_id: number; quantity: number; order_line_id: number }>(
      `SELECT ol.variant_id, ol.quantity, ol.order_line_id
       FROM order_line ol JOIN customer_order o ON o.order_id = ol.order_id
       WHERE o.customer_id = $1 AND o.order_status_id = 1
       ORDER BY ol.order_line_id`,
      [user.customer_id],
    );
    const snapshots = await snapshotRows(rows.map((row) => row.variant_id));
    const byId = new Map(snapshots.map((row) => [row.variant_id, row]));
    lines = rows.flatMap((row) => {
      const snapshot = byId.get(row.variant_id);
      return snapshot ? [toCartLine(snapshot, row.quantity, row.order_line_id)] : [];
    });
  } else {
    const guest = await readGuestCart();
    const snapshots = await snapshotRows(guest.map((line) => line.variantId));
    const byId = new Map(snapshots.map((row) => [row.variant_id, row]));
    lines = guest.flatMap((line) => {
      const snapshot = byId.get(line.variantId);
      return snapshot ? [toCartLine(snapshot, line.quantity, null)] : [];
    });
  }
  const subtotal_cents = lines.reduce((sum, line) => sum + line.unit_price_cents * line.quantity, 0);
  const discount_cents = lines.reduce((sum, line) => sum + line.discount_cents * line.quantity, 0);
  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal_cents,
    discount_cents,
    shipping_cents: 0,
    total_cents: subtotal_cents,
  };
}

export async function getCartCount(user: SessionUser | null): Promise<number> {
  if (!user) return (await readGuestCart()).reduce((sum, line) => sum + line.quantity, 0);
  const row = await queryOne<{ count: number }>(
    `SELECT COALESCE(SUM(ol.quantity), 0)::int AS count
     FROM customer_order o JOIN order_line ol ON ol.order_id = o.order_id
     WHERE o.customer_id = $1 AND o.order_status_id = 1`,
    [user.customer_id],
  );
  return row?.count ?? 0;
}

async function ensureCart(client: PoolClient, customerId: number): Promise<number> {
  // The partial unique index uq_one_cart_per_customer makes ON CONFLICT safe.
  const row = await client.query<{ order_id: number }>(
    `INSERT INTO customer_order (customer_id, order_status_id, created_at, updated_at)
     VALUES ($1, 1, now(), now())
     ON CONFLICT (customer_id) WHERE order_status_id = 1
     DO UPDATE SET updated_at = now()
     RETURNING order_id`,
    [customerId],
  );
  return row.rows[0].order_id;
}

async function upsertLine(client: PoolClient, orderId: number, snapshot: SnapshotRow, quantity: number) {
  await client.query(
    `INSERT INTO order_line (order_id, variant_id, quantity, product_name, sku, option_summary, unit_price, discount_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (order_id, variant_id) DO UPDATE SET
       quantity = EXCLUDED.quantity, product_name = EXCLUDED.product_name, sku = EXCLUDED.sku,
       option_summary = EXCLUDED.option_summary, unit_price = EXCLUDED.unit_price,
       discount_amount = EXCLUDED.discount_amount`,
    [orderId, snapshot.variant_id, quantity, snapshot.product_name, snapshot.sku, snapshot.option_summary,
      toDecimal(toCents(snapshot.price)), toDecimal(Math.max(0, toCents(snapshot.price) - Number(snapshot.effective_cents)))],
  );
}

function assertAvailable(snapshot: SnapshotRow | null, quantity: number): asserts snapshot is SnapshotRow {
  if (!snapshot || snapshot.qty_in_stock < quantity) {
    throw new ApiError("That variant no longer has enough stock", 409, "out_of_stock");
  }
}

export async function addToCart(user: SessionUser | null, variantId: number, quantity: number): Promise<void> {
  if (!Number.isInteger(variantId) || variantId <= 0) throw new ApiError("Invalid variant", 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new ApiError("Quantity must be between 1 and 99", 422);
  const snapshot = await getVariantSnapshot(variantId);
  assertAvailable(snapshot, quantity);

  if (!user) {
    const current = await readGuestCart();
    const existing = current.find((line) => line.variantId === variantId);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > snapshot.qty_in_stock || nextQuantity > 99) {
      throw new ApiError("Requested quantity exceeds available stock", 409, "out_of_stock");
    }
    const lines: GuestCartLine[] = existing
      ? current.map((line) => line.variantId === variantId ? { ...line, quantity: nextQuantity } : line)
      : [...current, { variantId, quantity }];
    await writeGuestCart(lines);
    return;
  }

  await withTransaction(async (client) => {
    const orderId = await ensureCart(client, user.customer_id);
    const current = await client.query<{ quantity: number }>(
      `SELECT ol.quantity FROM order_line ol WHERE ol.order_id = $1 AND ol.variant_id = $2 FOR UPDATE`,
      [orderId, variantId],
    );
    const nextQuantity = (current.rows[0]?.quantity ?? 0) + quantity;
    if (nextQuantity > snapshot.qty_in_stock || nextQuantity > 99) {
      throw new ApiError("Requested quantity exceeds available stock", 409, "out_of_stock");
    }
    await upsertLine(client, orderId, snapshot, nextQuantity);
  });
}

export async function updateCartLine(user: SessionUser | null, variantId: number, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new ApiError("Invalid quantity", 422);
  if (!user) {
    const lines = (await readGuestCart())
      .map((line) => line.variantId === variantId ? { ...line, quantity } : line)
      .filter((line) => line.quantity > 0);
    await writeGuestCart(lines);
    return;
  }
  await withTransaction(async (client) => {
    const cart = await client.query<{ order_id: number }>(
      `SELECT order_id FROM customer_order WHERE customer_id = $1 AND order_status_id = 1 FOR UPDATE`,
      [user.customer_id],
    );
    if (!cart.rows[0]) return;
    if (quantity === 0) {
      await client.query(`DELETE FROM order_line WHERE order_id = $1 AND variant_id = $2`, [cart.rows[0].order_id, variantId]);
    } else {
      const snapshot = await getVariantSnapshot(variantId);
      assertAvailable(snapshot, quantity);
      await upsertLine(client, cart.rows[0].order_id, snapshot, quantity);
    }
  });
}

export async function clearCart(user: SessionUser | null): Promise<void> {
  if (!user) {
    await clearGuestCart();
    return;
  }
  await withTransaction(async (client) => {
    const cart = await client.query<{ order_id: number }>(
      `SELECT order_id FROM customer_order WHERE customer_id = $1 AND order_status_id = 1 FOR UPDATE`, [user.customer_id]);
    if (!cart.rows[0]) return;
    await client.query(`DELETE FROM order_line WHERE order_id = $1`, [cart.rows[0].order_id]);
  });
}

/** Called after login/signup so items added as a guest follow the customer. */
export async function mergeGuestCart(user: SessionUser): Promise<void> {
  const guest = await readGuestCart();
  if (!guest.length) return;
  await withTransaction(async (client) => {
    const orderId = await ensureCart(client, user.customer_id);
    const snapshots = await snapshotRows(guest.map((line) => line.variantId));
    for (const snapshot of snapshots) {
      const wanted = guest.find((line) => line.variantId === snapshot.variant_id)!.quantity;
      const current = await client.query<{ quantity: number }>(
        `SELECT quantity FROM order_line WHERE order_id = $1 AND variant_id = $2 FOR UPDATE`,
        [orderId, snapshot.variant_id],
      );
      const quantity = Math.min(snapshot.qty_in_stock, 99, wanted + (current.rows[0]?.quantity ?? 0));
      if (quantity > 0) await upsertLine(client, orderId, snapshot, quantity);
    }
  });
  await clearGuestCart();
}
