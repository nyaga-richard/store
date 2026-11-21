export interface CategoryNode {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
  product_count: number;
}

export interface ProductListItem {
  product_id: number;
  product_name: string;
  brand: string | null;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  effective_cents: number;
  discount_percent: number;
  variant_count: number;
  category_ids: number[];
}

export interface ProductOption {
  option_id: number;
  option_name: string;
  values: { option_value_id: number; value_name: string }[];
}

export interface ProductVariantView {
  variant_id: number;
  sku: string;
  price_cents: number;
  effective_cents: number;
  qty_in_stock: number;
  option_summary: string | null;
  selections: { optionId: number; valueId: number }[];
  image_url: string | null;
}

export interface Review {
  review_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: string;
  product_name: string | null;
}

export interface ProductDetail extends ProductListItem {
  created_at: string | null;
  images: { image_id: number; variant_id: number | null; image_url: string; sort_order: number }[];
  options: ProductOption[];
  variants: ProductVariantView[];
  reviews: Review[];
  rating_avg: number;
}

export interface CartLine {
  order_line_id: number | null;
  variant_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  option_summary: string | null;
  image_url: string | null;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
  available: number;
  is_active: boolean;
}

export interface CartView {
  lines: CartLine[];
  count: number;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
}

export interface Address {
  address_id: number;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postal_code: string | null;
  country_id: number;
  country_name: string | null;
  is_default: boolean;
}

export interface PaymentMethodView {
  payment_method_id: number;
  provider: string;
  card_brand: string | null;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  type_name: string;
}

export interface ShippingMethod {
  shipping_method_id: number;
  method_name: string;
  price_cents: number;
}

export interface Country {
  country_id: number;
  country_name: string;
}

export interface OrderSummary {
  order_id: number;
  order_date: string | null;
  status_name: string;
  order_total_cents: number;
  item_count: number;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  ship_name: string | null;
  ship_address_line1: string | null;
  ship_address_line2: string | null;
  ship_city: string | null;
  ship_region: string | null;
  ship_postal_code: string | null;
  ship_country: string | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  payment_status: string | null;
  payment_reference: string | null;
  lines: {
    order_line_id: number;
    product_name: string;
    sku: string;
    option_summary: string | null;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
    reviewed: boolean;
  }[];
}
