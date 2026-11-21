import { NextResponse } from "next/server";
import { ApiError, fail, ok, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = reviewSchema.extend({ order_line_id: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Please sign in to review a purchase", 401, "unauthorized");
    const input = await parseBody(request, schema);
    await withTransaction(async (client) => {
      const line = await client.query<{ order_line_id: number }>(
        `SELECT ol.order_line_id FROM order_line ol
         JOIN customer_order o ON o.order_id = ol.order_id
         LEFT JOIN review r ON r.order_line_id = ol.order_line_id
         WHERE ol.order_line_id = $1 AND o.customer_id = $2
           AND o.order_status_id NOT IN (1, 6) AND r.review_id IS NULL
         FOR UPDATE OF ol`,
        [input.order_line_id, user.customer_id],
      );
      if (!line.rows[0]) throw new ApiError("This purchase cannot be reviewed (or was already reviewed)", 404, "review_not_allowed");
      await client.query(
        `INSERT INTO review (order_line_id, rating, comment, created_at) VALUES ($1,$2,$3,now())`,
        [input.order_line_id, input.rating, input.comment || null],
      );
    });
    return ok({ created: true }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: { message: "You already reviewed this purchase", code: "already_reviewed" } }, { status: 409 });
    }
    if ((error as { code?: string }).code === "23514") {
      return NextResponse.json({ ok: false, error: { message: "Rating must be between 1 and 5", code: "invalid_rating" } }, { status: 422 });
    }
    return fail(error);
  }
}
