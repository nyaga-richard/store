import { listAdminCategories } from "@/lib/admin-data";
import { CategoryManager } from "@/components/CategoryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Categories</h2><p className="muted">Set a parent to build the store navigation tree.</p></div>
      <CategoryManager categories={categories} />
    </div>
  );
}
