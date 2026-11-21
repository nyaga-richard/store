import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Uploaded images live on a persistent volume outside Next.js' static manifest. */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(join(process.cwd(), ".data", "uploads", name));
    const ext = name.slice(name.lastIndexOf(".") + 1);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
