import { NextResponse } from "next/server";
import { dbHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await dbHealth();
  return NextResponse.json({ status: database ? "ok" : "degraded", database }, { status: database ? 200 : 503 });
}
