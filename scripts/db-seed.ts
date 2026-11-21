import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(scryptCb);

interface VariantSpec {
  sku: string;
  price: string;
  stock: number;
  selections: Record<string, string>;
}

interface ProductSpec {
  name: string;
  brand: string;
  description: string;
  image: string;
  categories: string[];
  options?: Record<string, string[]>;
  variants: VariantSpec[];
}

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;

const products: ProductSpec[] = [
  {
    name: "Aurora Wireless Headphones", brand: "Nova Audio",
    description: "Immersive over-ear sound with active noise cancellation, 40-hour battery life and a comfortable memory-foam fit.",
    image: img("photo-1505740420928-5e560c06d30e"), categories: ["Audio", "Electronics"],
    options: { Colour: ["Midnight Black", "Cloud White"] },
    variants: [
      { sku: "NV-AUR-BLK", price: "12900.00", stock: 14, selections: { Colour: "Midnight Black" } },
      { sku: "NV-AUR-WHT", price: "13400.00", stock: 9, selections: { Colour: "Cloud White" } },
    ],
  },
  {
    name: "Pulse Smartwatch S2", brand: "Nova Audio",
    description: "A bright AMOLED display, GPS, sleep tracking and 7-day battery life in a lightweight aluminium case.",
    image: img("photo-1523275335684-37898b6baf30"), categories: ["Wearables", "Electronics"],
    options: { Colour: ["Graphite", "Silver"], Size: ["42mm", "46mm"] },
    variants: [
      { sku: "NV-PUL-G-42", price: "18900.00", stock: 11, selections: { Colour: "Graphite", Size: "42mm" } },
      { sku: "NV-PUL-G-46", price: "19900.00", stock: 7, selections: { Colour: "Graphite", Size: "46mm" } },
      { sku: "NV-PUL-S-42", price: "18900.00", stock: 6, selections: { Colour: "Silver", Size: "42mm" } },
      { sku: "NV-PUL-S-46", price: "20400.00", stock: 4, selections: { Colour: "Silver", Size: "46mm" } },
    ],
  },
  {
    name: "Mecha Mechanical Keyboard", brand: "KeyForge",
    description: "Hot-swappable mechanical switches, a compact aluminium frame and per-key RGB lighting for desk and game.",
    image: img("photo-1587829741301-dc798b83add3"), categories: ["Electronics"],
    options: { Switch: ["Blue", "Brown"], Layout: ["60%", "87%"] },
    variants: [
      { sku: "KF-MCH-B-60", price: "8900.00", stock: 18, selections: { Switch: "Blue", Layout: "60%" } },
      { sku: "KF-MCH-B-87", price: "10900.00", stock: 12, selections: { Switch: "Blue", Layout: "87%" } },
      { sku: "KF-MCH-N-60", price: "8900.00", stock: 0, selections: { Switch: "Brown", Layout: "60%" } },
      { sku: "KF-MCH-N-87", price: "10900.00", stock: 8, selections: { Switch: "Brown", Layout: "87%" } },
    ],
  },
  {
    name: "Echo Mini Bluetooth Speaker", brand: "Nova Audio",
    description: "Pocket-sized 360° sound with an IP67 waterproof shell and 18 hours of playtime.",
    image: img("photo-1608043152269-423dbba4e7e1"), categories: ["Audio", "Electronics"],
    options: { Colour: ["Charcoal", "Coral", "Teal"] },
    variants: [
      { sku: "NV-ECH-CHR", price: "5900.00", stock: 25, selections: { Colour: "Charcoal" } },
      { sku: "NV-ECH-COR", price: "5900.00", stock: 16, selections: { Colour: "Coral" } },
      { sku: "NV-ECH-TEA", price: "6200.00", stock: 13, selections: { Colour: "Teal" } },
    ],
  },
  {
    name: "Lumen Adjustable Desk Lamp", brand: "Haven Home",
    description: "Dimmable warm-to-cool LED lighting with a flexible arm and built-in wireless charging base.",
    image: img("photo-1507473885765-e6ed057f782c"), categories: ["Home & Living"],
    options: { Colour: ["Sand", "Charcoal"] },
    variants: [
      { sku: "HV-LUM-SND", price: "7400.00", stock: 20, selections: { Colour: "Sand" } },
      { sku: "HV-LUM-CHR", price: "7400.00", stock: 15, selections: { Colour: "Charcoal" } },
    ],
  },
  {
    name: "Terra Ceramic Mug", brand: "Haven Home",
    description: "Hand-finished stoneware mug with a comfortable handle; microwave and dishwasher safe.",
    image: img("photo-1514228742587-6b1558fcca3d"), categories: ["Kitchen", "Home & Living"],
    options: { Colour: ["Sand", "Olive", "Slate"] },
    variants: [
      { sku: "HV-TER-SND", price: "1650.00", stock: 40, selections: { Colour: "Sand" } },
      { sku: "HV-TER-OLV", price: "1650.00", stock: 32, selections: { Colour: "Olive" } },
      { sku: "HV-TER-SLT", price: "1750.00", stock: 28, selections: { Colour: "Slate" } },
    ],
  },
  {
    name: "Trailday Backpack 28L", brand: "Northline",
    description: "A water-resistant 28-litre daypack with a padded laptop sleeve and breathable back panel.",
    image: img("photo-1553062407-98eeb64c6a62"), categories: ["Accessories"],
    options: { Colour: ["Forest", "Black"] },
    variants: [
      { sku: "NL-TRL-FST", price: "6800.00", stock: 17, selections: { Colour: "Forest" } },
      { sku: "NL-TRL-BLK", price: "6800.00", stock: 22, selections: { Colour: "Black" } },
    ],
  },
  {
    name: "Nova X1 Smartphone", brand: "Nova",
    description: "A 6.7-inch AMOLED display, 108MP camera and a 5000mAh battery with 33W fast charging.",
    image: img("photo-1511707171634-5f897ff02aa9"), categories: ["Electronics"],
    options: { Storage: ["128GB", "256GB"], Colour: ["Midnight", "Sky"] },
    variants: [
      { sku: "NV-X1-128-M", price: "42900.00", stock: 10, selections: { Storage: "128GB", Colour: "Midnight" } },
      { sku: "NV-X1-128-S", price: "42900.00", stock: 8, selections: { Storage: "128GB", Colour: "Sky" } },
      { sku: "NV-X1-256-M", price: "47900.00", stock: 5, selections: { Storage: "256GB", Colour: "Midnight" } },
      { sku: "NV-X1-256-S", price: "47900.00", stock: 6, selections: { Storage: "256GB", Colour: "Sky" } },
    ],
  },
  {
    name: "Glide Wireless Mouse", brand: "KeyForge",
    description: "Silent clicks, a 1600 DPI sensor and USB-C charging in a compact ergonomic shape.",
    image: img("photo-1527864550417-7fd91fc51a46"), categories: ["Electronics"],
    options: { Colour: ["Black", "White"] },
    variants: [
      { sku: "KF-GLD-BLK", price: "2900.00", stock: 30, selections: { Colour: "Black" } },
      { sku: "KF-GLD-WHT", price: "3100.00", stock: 24, selections: { Colour: "White" } },
    ],
  },
  {
    name: "Stride Runner Sneakers", brand: "Northline",
    description: "Lightweight everyday runners with a responsive foam midsole and breathable knit upper.",
    image: img("photo-1542291026-7eec264c27ff"), categories: ["Fashion"],
    options: { Size: ["39", "40", "41", "42", "43"] },
    variants: [
      { sku: "NL-STR-39", price: "5400.00", stock: 9, selections: { Size: "39" } },
      { sku: "NL-STR-40", price: "5400.00", stock: 14, selections: { Size: "40" } },
      { sku: "NL-STR-41", price: "5400.00", stock: 16, selections: { Size: "41" } },
      { sku: "NL-STR-42", price: "5400.00", stock: 11, selections: { Size: "42" } },
      { sku: "NL-STR-43", price: "5400.00", stock: 6, selections: { Size: "43" } },
    ],
  },
  {
    name: "Barista Blender Pro", brand: "Haven Home",
    description: "A 1200W countertop blender with six preset programs and a 1.5L borosilicate glass jug.",
    image: img("photo-1570222094114-d054a817e56b"), categories: ["Kitchen", "Home & Living"],
    variants: [{ sku: "HV-BAR-001", price: "13900.00", stock: 9, selections: {} }],
  },
  {
    name: "Solstice Sunglasses", brand: "Northline",
    description: "Polarised UV400 lenses in a lightweight acetate frame, with a hard case included.",
    image: img("photo-1511499767150-a48a237f0083"), categories: ["Fashion", "Accessories"],
    options: { Colour: ["Tortoise", "Black"] },
    variants: [
      { sku: "NL-SOL-TOR", price: "3900.00", stock: 21, selections: { Colour: "Tortoise" } },
      { sku: "NL-SOL-BLK", price: "3900.00", stock: 19, selections: { Colour: "Black" } },
    ],
  },
  {
    name: "Ergo Office Chair", brand: "Haven Home",
    description: "Mesh-backed ergonomic chair with lumbar support, adjustable armrests and a five-year warranty.",
    image: img("photo-1503602642458-232111445657"), categories: ["Home & Living"],
    options: { Colour: ["Black", "Grey"] },
    variants: [
      { sku: "HV-ERG-BLK", price: "21900.00", stock: 7, selections: { Colour: "Black" } },
      { sku: "HV-ERG-GRY", price: "21900.00", stock: 5, selections: { Colour: "Grey" } },
    ],
  },
];

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: url, application_name: "store-seed" });
  await client.connect();
  try {
    await client.query("BEGIN");
    console.log("Seeding reference data ...");

    // Fixed IDs matter: the application treats 1 = Cart and 2 = Placed.
    const statuses = ["Cart", "Placed", "Paid", "Shipped", "Delivered", "Cancelled"];
    for (let i = 0; i < statuses.length; i++) {
      await client.query(`INSERT INTO order_status (order_status_id, status_name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [i + 1, statuses[i]]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('order_status','order_status_id'),
      GREATEST((SELECT MAX(order_status_id) FROM order_status), 1), true)`);

    for (const name of ["Kenya", "Uganda", "Tanzania", "Nigeria", "South Africa", "United Kingdom", "United States", "India"]) {
      await client.query(`INSERT INTO country (country_name) VALUES ($1) ON CONFLICT (country_name) DO NOTHING`, [name]);
    }
    for (const name of ["Card", "PayPal", "Bank Transfer"]) {
      await client.query(`INSERT INTO payment_type (type_name) VALUES ($1) ON CONFLICT (type_name) DO NOTHING`, [name]);
    }
    for (const [name, price] of [["Standard", "500.00"], ["Express", "1200.00"], ["Store Pickup", "0.00"]] as const) {
      await client.query(`INSERT INTO shipping_method (method_name, price) VALUES ($1,$2) ON CONFLICT (method_name) DO NOTHING`, [name, price]);
    }

    type Category = { id: number; name: string; parent: number | null };
    const categoryRows = await client.query<Category>(`SELECT category_id AS id, category_name AS name, parent_category_id AS parent FROM category`);
    const categoryByName = new Map(categoryRows.rows.map((row) => [row.name, row.id]));
    const categorySpecs: [string, string | null][] = [
      ["Electronics", null], ["Audio", "Electronics"], ["Wearables", "Electronics"], ["Cameras", "Electronics"],
      ["Home & Living", null], ["Kitchen", "Home & Living"], ["Fashion", null], ["Accessories", null],
    ];
    for (const [name, parentName] of categorySpecs) {
      const parent = parentName ? categoryByName.get(parentName) ?? null : null;
      let id = categoryByName.get(name);
      if (!id) {
        const result = await client.query<{ id: number }>(
          `INSERT INTO category (category_name, parent_category_id) VALUES ($1,$2) RETURNING category_id AS id`, [name, parent]);
        id = result.rows[0].id;
        categoryByName.set(name, id);
      }
    }

    console.log(`Seeding ${products.length} products ...`);
    let productsAdded = 0;
    for (const spec of products) {
      const exists = await client.query<{ variant_id: number }>(
        `SELECT v.variant_id FROM product_variant v WHERE v.sku = $1`, [spec.variants[0].sku]);
      if (exists.rows[0]) continue;
      productsAdded++;
      const productResult = await client.query<{ product_id: number }>(
        `INSERT INTO product (product_name, description, brand, created_at) VALUES ($1,$2,$3,now()) RETURNING product_id`,
        [spec.name, spec.description, spec.brand]);
      const productId = productResult.rows[0].product_id;
      for (const categoryName of spec.categories) {
        const categoryId = categoryByName.get(categoryName);
        if (categoryId) await client.query(`INSERT INTO product_category (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [productId, categoryId]);
      }
      await client.query(
        `INSERT INTO product_image (product_id, variant_id, image_url, sort_order) VALUES ($1,NULL,$2,1)`, [productId, spec.image]);

      const optionIds = new Map<string, number>();
      const valueIds = new Map<string, number>();
      for (const [optionName, values] of Object.entries(spec.options ?? {})) {
        const optionResult = await client.query<{ option_id: number }>(
          `INSERT INTO product_option (product_id, option_name) VALUES ($1,$2) RETURNING option_id`, [productId, optionName]);
        const optionId = optionResult.rows[0].option_id;
        optionIds.set(optionName, optionId);
        for (const value of values) {
          const valueResult = await client.query<{ option_value_id: number }>(
            `INSERT INTO product_option_value (option_id, value_name) VALUES ($1,$2) RETURNING option_value_id`, [optionId, value]);
          valueIds.set(`${optionName}:${value}`, valueResult.rows[0].option_value_id);
        }
      }
      for (const variant of spec.variants) {
        const variantResult = await client.query<{ variant_id: number }>(
          `INSERT INTO product_variant (product_id, sku, price, qty_in_stock) VALUES ($1,$2,$3,$4) RETURNING variant_id`,
          [productId, variant.sku, variant.price, variant.stock]);
        const variantId = variantResult.rows[0].variant_id;
        for (const [optionName, value] of Object.entries(variant.selections)) {
          const optionId = optionIds.get(optionName);
          const valueId = valueIds.get(`${optionName}:${value}`);
          if (optionId && valueId) {
            await client.query(
              `INSERT INTO variant_option_value (variant_id, option_id, option_value_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
              [variantId, optionId, valueId]);
          }
        }
      }
    }

    const promoSpecs = [
      { name: "Welcome 10% off Audio", type: "Percentage", value: "10.00", days: [-7, 90], products: ["NV-AUR-BLK", "NV-ECH-CHR"] },
      { name: "KES 500 off Smartwatches", type: "Fixed", value: "500.00", days: [-3, 60], products: ["NV-PUL-G-42", "NV-PUL-S-46"] },
      { name: "Weekend Tech Sale 15%", type: "Percentage", value: "15.00", days: [-2, 30], products: ["KF-MCH-B-87", "KF-GLD-BLK", "NV-X1-128-M"] },
    ];
    let promotionsAdded = 0;
    for (const spec of promoSpecs) {
      const existing = await client.query<{ promotion_id: number }>(
        `SELECT promotion_id FROM promotion WHERE promotion_name = $1`, [spec.name]);
      let promotionId: number;
      if (existing.rows[0]) {
        promotionId = existing.rows[0].promotion_id;
      } else {
        promotionsAdded++;
        const result = await client.query<{ promotion_id: number }>(
          `INSERT INTO promotion (promotion_name, description, discount_type, discount_value, start_date, end_date)
           VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval, now() + ($6 || ' days')::interval)
           RETURNING promotion_id`,
          [spec.name, `${spec.value} ${spec.type.toLowerCase()} discount`, spec.type, spec.value, spec.days[0], spec.days[1]]);
        promotionId = result.rows[0].promotion_id;
      }
      for (const sku of spec.products) {
        const variant = await client.query<{ product_id: number }>(`SELECT product_id FROM product_variant WHERE sku = $1`, [sku]);
        if (variant.rows[0]) {
          await client.query(`INSERT INTO promotion_product (promotion_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [promotionId, variant.rows[0].product_id]);
        }
      }
    }

    const hasSuppliers = await client.query<{ exists: boolean }>(
      `SELECT to_regclass('public.supplier') IS NOT NULL AS exists`);
    if (hasSuppliers.rows[0].exists) {
      for (const [name, contact, email, phone, city] of [
        ["Nairobi Tech Supplies", "Peter Kamau", "sales@nairobitech.co.ke", "+254722000111", "Nairobi"],
        ["Lake Region Electronics", "Achieng Otieno", "orders@lakeregion.co.ke", "+254733000222", "Kisumu"],
        ["Coast Home Goods", "Salim Hassan", "supply@coasthome.co.ke", "+254744000333", "Mombasa"],
      ]) {
        await client.query(
          `INSERT INTO supplier (supplier_name, contact_name, email, phone, city, created_at)
           VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (supplier_name) DO NOTHING`,
          [name, contact, email, phone, city],
        );
      }
    }

    const demoEmail = "demo@trustedsystems.co.ke";
    const demo = await client.query<{ customer_id: number }>(`SELECT customer_id FROM customer WHERE email = $1`, [demoEmail]);
    if (!demo.rows[0]) {
      const passwordHash = await hashPassword("Demo123!");
      const customer = await client.query<{ customer_id: number }>(
        `INSERT INTO customer (email, password_hash, first_name, last_name, phone, created_at)
         VALUES ($1,$2,'Demo','Customer','+254700000000',now()) RETURNING customer_id`, [demoEmail, passwordHash]);
      const kenya = await client.query<{ country_id: number }>(`SELECT country_id FROM country WHERE country_name = 'Kenya'`);
      await client.query(
        `INSERT INTO address (customer_id, address_line1, city, region, postal_code, country_id, is_default)
         VALUES ($1,'12 Riverside Drive','Nairobi','Nairobi County','00100',$2,true)`, [customer.rows[0].customer_id, kenya.rows[0].country_id]);
      const card = await client.query<{ payment_type_id: number }>(`SELECT payment_type_id FROM payment_type WHERE type_name = 'Card'`);
      await client.query(
        `INSERT INTO payment_method (customer_id, payment_type_id, provider, provider_token, card_brand, last_four, expiry_month, expiry_year, is_default)
         VALUES ($1,$2,'Mock','tok_demo_4242','Visa','4242',12,2030,true)`, [customer.rows[0].customer_id, card.rows[0].payment_type_id]);
      console.log(`Demo account created: ${demoEmail} / Demo123!`);
    }

    await client.query("COMMIT");
    console.log(`Seed complete: ${productsAdded} products added, ${promotionsAdded} promotions added (existing rows untouched).`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
