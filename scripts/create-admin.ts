import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(scryptCb);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: npm run admin:create -- you@example.com 'StrongPassword123'");
  }
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = new Client({ connectionString: url, application_name: "store-admin-bootstrap" });
  await client.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ customer_id: number }>(
      `SELECT customer_id FROM customer WHERE email = $1 FOR UPDATE`, [email]);
    const password_hash = await hashPassword(password);
    let customerId: number;
    if (existing.rows[0]) {
      customerId = existing.rows[0].customer_id;
      await client.query(`UPDATE customer SET password_hash = $2 WHERE customer_id = $1`, [customerId, password_hash]);
      console.log(`Updated password for existing customer ${email}.`);
    } else {
      const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const result = await client.query<{ customer_id: number }>(
        `INSERT INTO customer (email, password_hash, first_name, last_name, created_at)
         VALUES ($1,$2,$3,'Admin',now()) RETURNING customer_id`,
        [email, password_hash, name.slice(0, 100) || "Admin"],
      );
      customerId = result.rows[0].customer_id;
      console.log(`Created admin customer ${email} (id ${customerId}).`);
    }
    await client.query("COMMIT");
    console.log(`\nNext: add ${email} to ADMIN_EMAILS in .env, then run: docker compose up -d --force-recreate app`);
    console.log("Then sign in at /login and open /admin.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Admin bootstrap failed:", error);
  process.exit(1);
});
