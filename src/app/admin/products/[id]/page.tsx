import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminProduct } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { getBackofficeUser } from "@/lib/admin";
import { ProductAdminForm } from "@/components/ProductAdminForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit product" };

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();
  const product = await getAdminProduct(productId);
  if (!product) notFound();
  const user = await getBackofficeUser();
  const categories = await query<{ category_id: number; category_name: string; parent_category_id: number | null }>(
    `SELECT category_id, category_name, parent_category_id FROM category ORDER BY category_name`);
  return (
    <div>
      <Link href="/admin/products" className="link text-sm">← Products</Link>
      <div className="mb-6 mt-3"><h2 className="text-xl font-bold">{product.product_name}</h2><p className="muted">SKU count: {product.variant_count}</p></div>
      <ProductAdminForm product={product} categories={categories} imageUrl={product.image_url} canDelete={user?.role === "owner" || user?.role === "admin"} />
    </div>
  );
}
