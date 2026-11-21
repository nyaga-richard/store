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
