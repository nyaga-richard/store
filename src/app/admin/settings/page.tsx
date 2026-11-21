import { getBackofficeUser } from "@/lib/admin";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsForm } from "@/components/SiteSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  const [settings, user] = await Promise.all([getSiteSettings(), getBackofficeUser()]);
  const canEdit = user?.role === "owner" || user?.role === "admin";
  return (
    <div>
      <div className="mb-6"><h2 className="text-xl font-bold">Site settings</h2><p className="muted">Edit storefront text and contact details without a rebuild.</p></div>
      <SiteSettingsForm settings={settings} canEdit={canEdit} />
    </div>
  );
}
