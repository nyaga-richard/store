import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { withTransaction } from "@/lib/db";
import { PAYMENT_SETTING_KEYS, getPaymentSettings, maskSecret, SECRET_KEYS, type PaymentSettingKey } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

const fields = Object.fromEntries(
  PAYMENT_SETTING_KEYS.map((key) => [key, z.string().max(1000).optional()]),
) as Record<PaymentSettingKey, z.ZodOptional<z.ZodString>>;
const schema = z.object({
  ...fields,
  clearSecrets: z.array(z.enum(SECRET_KEYS as [string, ...string[]])).max(10).optional(),
});

export async function GET() {
  try {
    await requireRole("owner", "admin");
    const settings = await getPaymentSettings();
    return ok({
      ...settings,
      ...Object.fromEntries(SECRET_KEYS.map((key) => [key, maskSecret(settings[key])])),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRole("owner", "admin");
    const input = await parseBody(request, schema);
    await withTransaction(async (client) => {
      for (const key of PAYMENT_SETTING_KEYS) {
        const value = input[key];
        if (value === undefined || value === "") continue; // blank means "keep current value"
        await client.query(
          `INSERT INTO payment_gateway_setting (setting_key, setting_value, updated_at) VALUES ($1,$2,now())
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
          [key, value],
        );
      }
      for (const key of input.clearSecrets ?? []) {
        await client.query(
          `INSERT INTO payment_gateway_setting (setting_key, setting_value, updated_at) VALUES ($1,'',now())
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = '', updated_at = now()`,
          [key],
        );
      }
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}
