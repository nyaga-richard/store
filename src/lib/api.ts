import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "bad_request",
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, error: { message: error.message, code: error.code } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      { ok: false, error: { message: first?.message ?? "Invalid input", code: "validation_error", fields: error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  console.error("API error", error);
  return NextResponse.json({ ok: false, error: { message: "Something went wrong. Please try again.", code: "internal_error" } }, { status: 500 });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new ApiError("Expected application/json", 415);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError("Malformed JSON body");
  }
  return schema.parse(json);
}

/** Idempotency keys must be explicit and reasonably sized. */
export function idempotencyKey(request: Request, body?: { idempotencyKey?: string }): string {
  const key = request.headers.get("idempotency-key") || body?.idempotencyKey || "";
  if (!/^[A-Za-z0-9._-]{16,128}$/.test(key)) {
    throw new ApiError("A valid Idempotency-Key header (16-128 URL-safe characters) is required", 428, "idempotency_required");
  }
  return key;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
