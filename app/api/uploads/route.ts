import { clientKey, fail, ok, rateLimit, requireUser } from "@/lib/api";
import { saveUpload } from "@/lib/data/misc";

const MAX_BYTES = 2.5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`upload:${clientKey(req, auth.user)}`, 20)) return fail("Too many uploads — wait a minute.", 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("No file uploaded");
  if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG or WebP images are allowed");
  if (file.size > MAX_BYTES) return fail("Image is too large (max 2.5 MB after compression)");
  const buf = Buffer.from(await file.arrayBuffer());
  // verify magic bytes, don't trust the declared type
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return fail("That file doesn't look like an image");
  const id = saveUpload(auth.user.id, isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp", buf);
  return ok({ url: `/api/uploads/${id}` });
}
