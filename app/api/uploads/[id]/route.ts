import { getUpload } from "@/lib/data/misc";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response("Not found", { status: 404 });
  const up = getUpload(id);
  if (!up) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(up.data), {
    headers: { "content-type": up.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
