import { listAdminPromotions } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { PromotionManager } from "@/components/PromotionManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Promotions" };

export default async function AdminPromotionsPage() {
  const [promotions, products] = await Promise.all([
    listAdminPromotions(),
    query<{ product_id: number; product_name: string }>(`SELECT product_id, product_name FROM product ORDER BY product_name`),
  ]);
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Promotions</h2><p className="muted">Discounts are recalculated server-side at checkout from these active rows.</p></div>
      <PromotionManager promotions={promotions} products={products} />
    </div>
  );
}
