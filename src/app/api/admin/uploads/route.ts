import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiError, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (bytes: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", magic: (b) => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { ext: "webp", magic: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
  "image/gif": { ext: "gif", magic: (b) => b.slice(0, 6).toString().startsWith("GIF8") },
};

export async function POST(request: Request) {
  try {
    await requireRole("owner", "admin", "manager");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Choose an image file", 422, "file_required");
    if (file.size > MAX_BYTES) throw new ApiError("Images must be 5 MB or smaller", 422, "file_too_large");
    const spec = TYPES[file.type];
    if (!spec) throw new ApiError("Only JPG, PNG, WebP and GIF images are allowed", 422, "invalid_image_type");

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!spec.magic(bytes)) throw new ApiError("Image contents do not match its file type", 422, "invalid_image_contents");

    const filename = `${randomUUID()}.${spec.ext}`;
    const directory = join(process.cwd(), ".data", "uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), bytes, { flag: "wx" });
    return ok({ url: `/api/uploads/${filename}` }, 201);
  } catch (error) {
    return fail(error);
  }
}
