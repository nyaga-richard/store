import Link from "next/link";
import { query } from "@/lib/db";
import { ProductCreateForm } from "@/components/ProductCreateForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = await query<{ category_id: number; category_name: string; parent_category_id: number | null }>(
    `SELECT category_id, category_name, parent_category_id FROM category ORDER BY category_name`);
  return (
    <div>
      <Link href="/admin/products" className="link text-sm">← Products</Link>
      <div className="mb-6 mt-3"><h2 className="text-xl font-bold">Add a new product</h2><p className="muted">Creates the product, first variant, category links and optional image.</p></div>
      <ProductCreateForm categories={categories} />
    </div>
  );
}
