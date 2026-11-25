import { aiStatus } from "@/lib/ai/claude";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for load balancers and uptime monitors. */
export async function GET() {
  const started = Date.now();
  try {
    const row = db().prepare("SELECT value FROM meta WHERE key = 'seeded_version'").get() as { value: string } | undefined;
    return Response.json(
      { status: "ok", db: { ok: true, seedVersion: row?.value ?? null, ms: Date.now() - started }, ai: aiStatus().provider, time: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return Response.json({ status: "error", error: (e as Error).message }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
