import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const schema = z.object(
  Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, z.string().max(1000).optional()])),
);

export async function PATCH(request: Request) {
  try {
    await requireRole("owner", "admin");
    const input = await parseBody(request, schema);
    await withTransaction(async (client) => {
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        await client.query(
          `INSERT INTO site_setting (setting_key, setting_value, updated_at) VALUES ($1,$2,now())
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
          [key, value],
        );
      }
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
