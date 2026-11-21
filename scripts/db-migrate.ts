import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: url, application_name: "store-migrate" });
  await client.connect();
  try {
    // Serialize concurrent deploy/update runs (e.g. two VPS sessions).
    await client.query("SELECT pg_advisory_lock(724195501)");
    const existing = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer') AS exists`);
    if (existing.rows[0].exists) {
      console.log("Schema already present — skipping (no destructive changes).");
      return;
    }
    const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
    console.log("Applying exact schema from db/schema.sql ...");
    await client.query("BEGIN");
    try {
      await client.query(schema);
      await client.query("COMMIT");
      console.log("Schema applied successfully (21 tables).");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(724195501)").catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
