import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { adminCustomerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("owner", "admin", "manager");
    const { id } = await params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) throw new ApiError("Invalid customer", 400);
    const input = await parseBody(request, adminCustomerSchema);
    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT customer_id FROM customer WHERE customer_id = $1 FOR UPDATE`, [customerId]);
      if (!existing.rows[0]) throw new ApiError("Customer not found", 404, "customer_not_found");
      const duplicate = await client.query(`SELECT customer_id FROM customer WHERE email = $1 AND customer_id <> $2`, [input.email, customerId]);
      if (duplicate.rows[0]) throw new ApiError("A customer with that email already exists", 409, "email_taken");
      const hash = input.password ? await hashPassword(input.password) : null;
      await client.query(
        `UPDATE customer SET email = $2, first_name = $3, last_name = $4, phone = $5,
                password_hash = COALESCE($6, password_hash)
         WHERE customer_id = $1`,
        [customerId, input.email, input.first_name, input.last_name, input.phone || null, hash],
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("owner", "admin");
    const { id } = await params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) throw new ApiError("Invalid customer", 400);
    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT customer_id FROM customer WHERE customer_id = $1 FOR UPDATE`, [customerId]);
      if (!existing.rows[0]) throw new ApiError("Customer not found", 404, "customer_not_found");
      const orders = await client.query(
        `SELECT 1 FROM customer_order WHERE customer_id = $1 AND order_status_id <> 1 LIMIT 1`, [customerId]);
      if (orders.rows[0]) throw new ApiError("Customers with order history cannot be deleted", 409, "customer_has_orders");
      const carts = await client.query<{ order_id: number }>(
        `SELECT order_id FROM customer_order WHERE customer_id = $1 AND order_status_id = 1`, [customerId]);
      for (const cart of carts.rows) {
        await client.query(`DELETE FROM order_line WHERE order_id = $1`, [cart.order_id]);
      }
      await client.query(`DELETE FROM customer_order WHERE customer_id = $1`, [customerId]);
      await client.query(`DELETE FROM payment_method WHERE customer_id = $1`, [customerId]);
      await client.query(`DELETE FROM address WHERE customer_id = $1`, [customerId]);
      await client.query(`DELETE FROM customer WHERE customer_id = $1`, [customerId]);
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
