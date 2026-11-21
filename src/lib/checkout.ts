import "server-only";
import type { PoolClient } from "pg";
import { ApiError } from "./api";
import { type SessionUser } from "./auth";
import { getCart } from "./cart";
import { query, queryOne, withTransaction } from "./db";
import { toCents, toDecimal, percentageDiscount } from "./money";
import { getPaymentProvider } from "./payments";
import type { ProviderWebhookEvent } from "./payments/types";
import type { ShippingMethod } from "./types";

export const STATUS_CART = 1;
export const STATUS_PLACED = 2;
export const STATUS_PAID = 3;
export const STATUS_CANCELLED = 6;

export interface CheckoutInput {
  // Exactly one of addressId or newAddress must be supplied.
  addressId?: number;
  newAddress?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    region?: string;
    postal_code?: string;
    country_id: number;
    is_default?: boolean;
  };
  shipping_method_id: number;
  // Exactly one of paymentMethodId or newPaymentToken must be supplied.
  paymentMethodId?: number;
  newPaymentToken?: string;
  cardBrand?: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

interface LockedLine {
  order_line_id: number;
  variant_id: number;
  quantity: number;
  product_id: number;
  product_name: string;
  sku: string;
  option_summary: string | null;
  price: string;
  qty_in_stock: number;
  is_active: boolean;
}

interface PromotionRow {
  product_id: number;
  discount_type: string;
  discount_value: string;
}

function bestDiscount(unitCents: number, promotions: PromotionRow[]): number {
  let best = 0;
  for (const promotion of promotions) {
    const raw = promotion.discount_type.toLowerCase() === "percentage"
      ? percentageDiscount(unitCents, promotion.discount_value)
      : toCents(promotion.discount_value);
    best = Math.max(best, Math.min(unitCents, raw));
  }
  return best;
}

async function shippingMethod(client: PoolClient, id: number): Promise<ShippingMethod> {
  const result = await client.query<ShippingMethod>(
    `SELECT shipping_method_id, method_name, (price * 100)::bigint::text AS price_cents
     FROM shipping_method WHERE shipping_method_id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError("Unknown shipping method", 422, "invalid_shipping_method");
  return { ...row, price_cents: Number(row.price_cents) };
}

interface AddressSnapshot {
  ship_name: string;
  ship_address_line1: string;
  ship_address_line2: string | null;
  ship_city: string;
  ship_region: string | null;
  ship_postal_code: string | null;
  ship_country: string;
}

async function resolveAddress(client: PoolClient, user: SessionUser, input: CheckoutInput): Promise<AddressSnapshot> {
  if (input.newAddress) {
    const a = input.newAddress;
    const country = await client.query<{ country_name: string }>(
      `SELECT country_name FROM country WHERE country_id = $1`, [a.country_id]);
    if (!country.rows[0]) throw new ApiError("Unknown country", 422, "invalid_country");
    if (a.is_default) {
      await client.query(`UPDATE address SET is_default = false WHERE customer_id = $1 AND is_default = true`, [user.customer_id]);
    }
    await client.query(
      `INSERT INTO address (customer_id, address_line1, address_line2, city, region, postal_code, country_id, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user.customer_id, a.address_line1, a.address_line2 || null, a.city, a.region || null, a.postal_code || null, a.country_id, a.is_default ?? false],
    );
    return {
      ship_name: `${user.first_name} ${user.last_name}`,
      ship_address_line1: a.address_line1,
      ship_address_line2: a.address_line2 || null,
      ship_city: a.city,
      ship_region: a.region || null,
      ship_postal_code: a.postal_code || null,
      ship_country: country.rows[0].country_name,
    };
  }
  if (!input.addressId) throw new ApiError("Choose or enter a shipping address", 422, "address_required");
  const result = await client.query<AddressSnapshot>(
    `SELECT CONCAT(c.first_name, ' ', c.last_name) AS ship_name, a.address_line1 AS ship_address_line1,
            a.address_line2 AS ship_address_line2, a.city AS ship_city, a.region AS ship_region,
            a.postal_code AS ship_postal_code, co.country_name AS ship_country
     FROM address a JOIN customer c ON c.customer_id = a.customer_id
     JOIN country co ON co.country_id = a.country_id
     WHERE a.address_id = $1 AND a.customer_id = $2`,
    [input.addressId, user.customer_id],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError("Address not found", 404, "address_not_found");
  return row;
}

async function resolvePaymentMethod(client: PoolClient, user: SessionUser, input: CheckoutInput): Promise<number | null> {
  if (input.paymentMethodId) {
    const result = await client.query<{ payment_method_id: number }>(
      `SELECT payment_method_id FROM payment_method WHERE payment_method_id = $1 AND customer_id = $2`,
      [input.paymentMethodId, user.customer_id],
    );
    if (!result.rows[0]) throw new ApiError("Payment method not found", 404, "payment_method_not_found");
    return result.rows[0].payment_method_id;
  }
  if (!input.newPaymentToken) throw new ApiError("Choose or add a payment method", 422, "payment_required");
  const type = await client.query<{ payment_type_id: number }>(
    `SELECT payment_type_id FROM payment_type WHERE type_name = 'Card'`);
  if (!type.rows[0]) throw new ApiError("Payment types are not configured", 500, "configuration_error");
  if (input.newAddress?.is_default) {
    // no-op: default handling is done by resolveAddress above
  }
  const isFirst = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM payment_method WHERE customer_id = $1`, [user.customer_id]);
  const isDefault = isFirst.rows[0].count === 0;
  if (isDefault) await client.query(`UPDATE payment_method SET is_default = false WHERE customer_id = $1`, [user.customer_id]);
  const provider = getPaymentProvider().name;
  const result = await client.query<{ payment_method_id: number }>(
    `INSERT INTO payment_method
       (customer_id, payment_type_id, provider, provider_token, card_brand, last_four, expiry_month, expiry_year, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING payment_method_id`,
    [user.customer_id, type.rows[0].payment_type_id, provider, input.newPaymentToken,
      input.cardBrand || null, input.lastFour || null, input.expiryMonth || null, input.expiryYear || null, isDefault],
  );
  return result.rows[0].payment_method_id;
}

export async function checkoutQuote(user: SessionUser, shippingMethodId?: number) {
  const cart = await getCart(user);
  let shipping_cents = 0;
  if (shippingMethodId) {
    const method = await queryOne<{ price_cents: string }>(
      `SELECT (price * 100)::bigint::text AS price_cents FROM shipping_method WHERE shipping_method_id = $1`,
      [shippingMethodId],
    );
    if (!method) throw new ApiError("Unknown shipping method", 422, "invalid_shipping_method");
    shipping_cents = Number(method.price_cents);
  }
  return { ...cart, shipping_cents, total_cents: cart.total_cents + shipping_cents };
}

/**
 * Places an order atomically: locks stock, re-prices lines from the database,
 * snapshots every monetary field, copies shipping details and reserves stock.
 * The external charge happens only after COMMIT; a webhook or the follow-up
 * update makes the payment/order state final.
 */
export async function checkout(user: SessionUser, input: CheckoutInput, key: string) {
  // Replay protection: an already-processed key returns the original order.
  const placeholders = [`key_${key}`, `mock_${key}`, `failed_${key}`];
  const previous = await queryOne<{ order_id: number }>(
    `SELECT o.order_id FROM customer_order o JOIN payment p ON p.order_id = o.order_id
     WHERE o.customer_id = $1 AND p.provider_reference = ANY($2::text[])
       AND o.order_status_id <> 1 ORDER BY o.order_id DESC LIMIT 1`,
    [user.customer_id, placeholders],
  );
  if (previous) return { orderId: previous.order_id, status: "already_processed" as const };

  const placed = await withTransaction(async (client) => {
    const cartResult = await client.query<{ order_id: number }>(
      `SELECT order_id FROM customer_order WHERE customer_id = $1 AND order_status_id = 1 FOR UPDATE`,
      [user.customer_id],
    );
    const orderId = cartResult.rows[0]?.order_id;
    if (!orderId) throw new ApiError("Your cart is empty", 409, "empty_cart");

    // Lock cart lines and variants in a deterministic order to avoid deadlocks.
    const linesResult = await client.query<LockedLine>(
      `SELECT ol.order_line_id, ol.variant_id, ol.quantity, v.product_id, p.product_name, ol.sku,
              ol.option_summary, p.is_active, v.price::text, v.qty_in_stock
       FROM order_line ol
       JOIN product_variant v ON v.variant_id = ol.variant_id
       JOIN product p ON p.product_id = v.product_id
       WHERE ol.order_id = $1
       ORDER BY ol.variant_id
       FOR UPDATE OF ol, v`,
      [orderId],
    );
    const lines = linesResult.rows;
    if (!lines.length) throw new ApiError("Your cart is empty", 409, "empty_cart");

    const promotionResult = await client.query<PromotionRow>(
      `SELECT pp.product_id, pr.discount_type, pr.discount_value
       FROM promotion_product pp JOIN promotion pr ON pr.promotion_id = pp.promotion_id
       WHERE pp.product_id = ANY($1::int[]) AND pr.start_date <= now() AND pr.end_date >= now()
       FOR SHARE OF pr`,
      [[...new Set(lines.map((line) => line.product_id))]],
    );
    const promotionsByProduct = new Map<number, PromotionRow[]>();
    for (const promotion of promotionResult.rows) {
      const list = promotionsByProduct.get(promotion.product_id) ?? [];
      list.push(promotion);
      promotionsByProduct.set(promotion.product_id, list);
    }

    let subtotal = 0;
    let discountTotal = 0;
    for (const line of lines) {
      if (!line.is_active) throw new ApiError("A product in your cart is no longer available", 409, "product_unavailable");
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        throw new ApiError("Invalid quantity in cart", 409, "invalid_cart");
      }
      if (line.quantity > line.qty_in_stock) {
        throw new ApiError("An item in your cart is out of stock", 409, "out_of_stock");
      }
      const unit = toCents(line.price);
      const lineDiscount = bestDiscount(unit, promotionsByProduct.get(line.product_id) ?? []);
      subtotal += unit * line.quantity;
      discountTotal += lineDiscount * line.quantity;
      await client.query(
        `UPDATE order_line SET product_name = $1, sku = $2, option_summary = $3,
                unit_price = $4, discount_amount = $5
         WHERE order_line_id = $6`,
        [line.product_name, line.sku, line.option_summary, toDecimal(unit), toDecimal(lineDiscount), line.order_line_id],
      );
    }

    for (const line of lines) {
      const updated = await client.query(
        `UPDATE product_variant SET qty_in_stock = qty_in_stock - $1
         WHERE variant_id = $2 AND qty_in_stock >= $1`,
        [line.quantity, line.variant_id],
      );
      if (updated.rowCount !== 1) throw new ApiError("Stock changed during checkout", 409, "out_of_stock");
    }

    const shipping = await shippingMethod(client, input.shipping_method_id);
    const address = await resolveAddress(client, user, input);
    const paymentMethodId = await resolvePaymentMethod(client, user, input);
    const orderTotal = subtotal - discountTotal + shipping.price_cents;
    if (orderTotal < 0) throw new ApiError("Invalid order total", 500, "invalid_total");

    await client.query(
      `INSERT INTO payment (order_id, payment_method_id, provider_reference, amount, payment_status, created_at)
       VALUES ($1,$2,$3,$4,'Pending',now())`,
      [orderId, paymentMethodId, `key_${key}`, toDecimal(orderTotal)],
    );

    await client.query(
      `UPDATE customer_order SET
         order_status_id = $2, order_date = now(), shipping_method_id = $3, shipping_cost = $4,
         ship_name = $5, ship_address_line1 = $6, ship_address_line2 = $7, ship_city = $8,
         ship_region = $9, ship_postal_code = $10, ship_country = $11,
         subtotal = $12, discount_total = $13, order_total = $14, updated_at = now()
       WHERE order_id = $1`,
      [orderId, STATUS_PLACED, input.shipping_method_id, toDecimal(shipping.price_cents),
        address.ship_name, address.ship_address_line1, address.ship_address_line2, address.ship_city,
        address.ship_region, address.ship_postal_code, address.ship_country,
        toDecimal(subtotal), toDecimal(discountTotal), toDecimal(orderTotal)],
    );
    return { orderId, amountCents: orderTotal, paymentMethodId };
  });

  const paymentToken = input.paymentMethodId
    ? (await queryOne<{ provider_token: string }>(
        `SELECT provider_token FROM payment_method WHERE payment_method_id = $1 AND customer_id = $2`,
        [input.paymentMethodId, user.customer_id]))?.provider_token
    : input.newPaymentToken!;

  if (!paymentToken) throw new ApiError("Payment method not found", 404, "payment_method_not_found");

  const charge = await getPaymentProvider().charge({
    orderId: placed.orderId,
    amountCents: placed.amountCents,
    currency: "kes",
    paymentToken,
    idempotencyKey: key,
    description: `Order #${placed.orderId} — Trusted Systems Store`,
    customerEmail: user.email,
  });

  await settlePayment({
    reference: charge.reference,
    orderId: placed.orderId,
    type: charge.status === "Succeeded" ? "payment.succeeded" : charge.status === "Failed" ? "payment.failed" : "payment.pending",
    message: charge.message,
  });

  return { orderId: placed.orderId, status: charge.status === "Succeeded" ? "paid" : charge.status === "Failed" ? "failed" : "pending", message: charge.message };
}

type SettleEvent = ProviderWebhookEvent["type"] | "payment.pending";

function restoreStock(client: PoolClient, orderId: number) {
  return client.query(
    `UPDATE product_variant v SET qty_in_stock = v.qty_in_stock + ol.quantity
     FROM order_line ol
     WHERE ol.order_id = $1 AND ol.variant_id = v.variant_id`,
    [orderId],
  );
}

/**
 * Idempotent payment state transitions used by both the checkout response and
 * provider webhooks. A repeated event never double-refunds or double-restocks.
 */
export async function settlePayment(event: {
  reference: string;
  orderId?: number;
  type: SettleEvent;
  message?: string;
}): Promise<boolean> {
  return withTransaction(async (client) => {
    const paymentResult = await client.query<{ payment_id: number; order_id: number; payment_status: string }>(
      `SELECT payment_id, order_id, payment_status FROM payment
       WHERE provider_reference = $1 OR (order_id = $2 AND payment_status IN ('Pending','Failed'))
       ORDER BY payment_id DESC LIMIT 1 FOR UPDATE`,
      [event.reference, event.orderId ?? -1],
    );
    const payment = paymentResult.rows[0];
    if (!payment) return false;
    if (payment.payment_status === "Succeeded" && event.type !== "payment.refunded") return true;

    const orderResult = await client.query<{ order_status_id: number }>(
      `SELECT order_status_id FROM customer_order WHERE order_id = $1 FOR UPDATE`, [payment.order_id]);
    const order = orderResult.rows[0];
    if (!order) return false;

    if (event.type === "payment.succeeded") {
      await client.query(`UPDATE payment SET provider_reference = $2, payment_status = 'Succeeded' WHERE payment_id = $1`,
        [payment.payment_id, event.reference]);
      if (order.order_status_id !== STATUS_CANCELLED) {
        await client.query(`UPDATE customer_order SET order_status_id = $2, updated_at = now() WHERE order_id = $1`,
          [payment.order_id, STATUS_PAID]);
      }
      return true;
    }

    if (event.type === "payment.pending") {
      await client.query(`UPDATE payment SET provider_reference = $2, payment_status = 'Pending' WHERE payment_id = $1`,
        [payment.payment_id, event.reference]);
      return true;
    }

    const status = event.type === "payment.refunded" ? "Refunded" : "Failed";
    await client.query(`UPDATE payment SET provider_reference = $2, payment_status = $3 WHERE payment_id = $1`,
      [payment.payment_id, event.reference, status]);
    if (order.order_status_id !== STATUS_CANCELLED) {
      await client.query(`UPDATE customer_order SET order_status_id = $2, updated_at = now() WHERE order_id = $1`,
        [payment.order_id, STATUS_CANCELLED]);
      await restoreStock(client, payment.order_id);
    }
    return true;
  });
}

export async function assertCartOwnership(customerId: number, orderId: number): Promise<boolean> {
  const row = await queryOne<{ order_id: number }>(
    `SELECT order_id FROM customer_order WHERE order_id = $1 AND customer_id = $2`, [orderId, customerId]);
  return Boolean(row);
}

