import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(255);
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const cartAddSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const cartUpdateSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(0).max(99),
});

const addressFields = z.object({
  address_line1: z.string().trim().min(2).max(255),
  address_line2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  country_id: z.number().int().positive(),
  is_default: z.boolean().optional(),
});

export const addressSchema = addressFields;

export const checkoutSchema = z.object({
  addressId: z.number().int().positive().optional(),
  newAddress: addressFields.optional(),
  shipping_method_id: z.number().int().positive(),
  paymentMethodId: z.number().int().positive().optional(),
  newPaymentToken: z.string().trim().min(6).max(255).optional(),
  cardBrand: z.string().trim().max(30).optional(),
  lastFour: z.string().trim().regex(/^\d{4}$/).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(2024).max(2100).optional(),
  idempotencyKey: z.string().optional(),
}).refine((value) => Boolean(value.addressId) !== Boolean(value.newAddress), {
  message: "Provide either a saved address or a new address",
  path: ["addressId"],
}).refine((value) => Boolean(value.paymentMethodId) !== Boolean(value.newPaymentToken), {
  message: "Provide either a saved payment method or a new token",
  path: ["paymentMethodId"],
});

export const paymentMethodSchema = z.object({
  provider_token: z.string().trim().min(6, "A payment provider token is required").max(255),
  card_brand: z.string().trim().max(30).optional(),
  last_four: z.string().trim().regex(/^\d{4}$/).optional(),
  expiry_month: z.number().int().min(1).max(12).optional(),
  expiry_year: z.number().int().min(2024).max(2100).optional(),
  is_default: z.boolean().optional(),
});

export const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const decimalMoney = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a valid amount (0.00 – 99999999.99)");
const imageUrlSchema = z.string().trim().refine(
  (value) => value.startsWith("/api/uploads/") || /^https?:\/\//.test(value),
  "Enter an http(s) URL or upload an image",
);

export const adminProductSchema = z.object({
  product_name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(20000).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  categoryIds: z.array(z.number().int().positive()).max(50).optional(),
  is_active: z.boolean().optional(),
  image_url: imageUrlSchema.optional().nullable(),
  variants: z.array(z.object({
    variant_id: z.number().int().positive(),
    price: decimalMoney,
    qty_in_stock: z.number().int().min(0).max(1_000_000),
  })).max(200).optional(),
});

export const adminOrderStatusSchema = z.object({
  order_status_id: z.number().int().positive(),
});

const promotionBase = z.object({
  promotion_name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  discount_type: z.enum(["Percentage", "Fixed"]),
  discount_value: decimalMoney.refine((value) => Number(value) > 0, "Discount must be greater than zero"),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  productIds: z.array(z.number().int().positive()).min(1, "Select at least one product").max(500),
});

export const promotionSchema = promotionBase.refine(
  (value) => new Date(value.start_date).getTime() < new Date(value.end_date).getTime(),
  { message: "End date must be after start date", path: ["end_date"] },
);

export const promotionUpdateSchema = promotionBase.partial().extend({
  promotion_id: z.number().int().positive(),
}).refine(
  (value) => !value.start_date || !value.end_date || new Date(value.start_date).getTime() < new Date(value.end_date).getTime(),
  { message: "End date must be after start date", path: ["end_date"] },
);

export const categorySchema = z.object({
  category_name: z.string().trim().min(1).max(100),
  parent_category_id: z.number().int().positive().nullable().optional(),
});

export const categoryUpdateSchema = categorySchema.extend({
  category_id: z.number().int().positive(),
});

export const adminCustomerSchema = z.object({
  email: emailSchema,
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  password: passwordSchema.optional(),
});

export const staffSchema = z.object({
  email: emailSchema,
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  role: z.enum(["owner", "admin", "manager", "staff"]),
  is_active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const supplierSchema = z.object({
  supplier_name: z.string().trim().min(2).max(150),
  contact_name: z.string().trim().max(100).optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  address_line1: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive(),
  expected_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(z.object({
    variant_id: z.number().int().positive(),
    quantity: z.number().int().positive().max(100_000),
    unit_cost: decimalMoney,
  })).min(1, "Add at least one item"),
});

export const purchaseActionSchema = z.object({
  purchase_order_id: z.number().int().positive(),
  action: z.enum(["receive", "cancel"]),
});

export const productCreateSchema = z.object({
  product_name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(20000).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  categoryIds: z.array(z.number().int().positive()).max(50).optional(),
  sku: z.string().trim().min(2).max(50),
  price: decimalMoney,
  qty_in_stock: z.number().int().min(0).max(1_000_000),
  image_url: imageUrlSchema.optional().nullable(),
  is_active: z.boolean().optional(),
});
