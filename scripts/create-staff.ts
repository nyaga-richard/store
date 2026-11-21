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
  const email = (process.argv[2] || process.env.STAFF_EMAIL || "").trim().toLowerCase();
  const password = process.argv[3] || process.env.STAFF_PASSWORD || "";
  const role = (process.argv[4] || process.env.STAFF_ROLE || "admin").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: npm run staff:create -- you@example.com 'StrongPassword123' [owner|admin|manager|staff]");
  }
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (!["owner", "admin", "manager", "staff"].includes(role)) throw new Error("Invalid role");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = new Client({ connectionString: url, application_name: "store-staff-bootstrap" });
  await client.connect();
  try {
    const password_hash = await hashPassword(password);
    const name = email.split("@")[0].replace(/[._-]+/g, " ");
    const result = await client.query<{ staff_id: number }>(
      `INSERT INTO staff_user (email, password_hash, first_name, last_name, role, is_active, created_at)
       VALUES ($1,$2,$3,'Staff',$4,true,now())
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role, is_active = true
       RETURNING staff_id`,
      [email, password_hash, name.slice(0, 100) || "Staff", role],
    );
    console.log(`Staff account ${email} (${role}) ready, id ${result.rows[0].staff_id}.`);
    console.log("Sign in at /staff/login, then open /admin.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Staff bootstrap failed:", error);
  process.exit(1);
});
