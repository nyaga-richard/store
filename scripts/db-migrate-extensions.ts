import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: url, application_name: "store-migrate-extensions" });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(724195502)");
    const base = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer') AS exists`);
    if (!base.rows[0].exists) throw new Error("Base schema is missing — run db:migrate first");

    // Every statement in extensions.sql is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
    // so re-running on every deploy also adds newly introduced settings tables.
    const sql = readFileSync(resolve(process.cwd(), "db/extensions.sql"), "utf8");
    console.log("Verifying/applying backoffice extensions from db/extensions.sql ...");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log("Extensions verified: product.is_active, staff, suppliers, purchases, site settings.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(724195502)").catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error("Extension migration failed:", error);
  process.exit(1);
});
