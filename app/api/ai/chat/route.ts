import { z } from "zod";
import { clientKey, fail, parseJson, rateLimit } from "@/lib/api";
import { runConcierge, type ChatEvent } from "@/lib/ai/concierge";
import { getCurrentUser } from "@/lib/auth";
import { meter } from "@/lib/data/billing";
import { getPlace } from "@/lib/data/places";

export const maxDuration = 120;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(40),
  context: z.object({ path: z.string().max(300).optional() }).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!rateLimit(`chat:${clientKey(req, user)}`, 20)) return fail("You're sending messages very quickly — please wait a moment.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { messages, context } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return fail("Last message must be from the user");
  const quota = meter(req, user, "chat");
  if (!quota.ok) return fail(quota.message, 402, { upgrade: true, quota: quota.status });

  // derive page context from the path the user is on
  const path = context?.path || "";
  let destinationSlug: string | undefined;
  let placeName: string | undefined;
  const dm = path.match(/^\/destinations\/([a-z0-9-]+)/);
  if (dm) destinationSlug = dm[1];
  const pm = path.match(/^\/place\/([a-z0-9-]+)/);
  if (pm) {
    const p = getPlace(pm[1]);
    if (p) {
      placeName = `${p.name} (${p.category}, ${p.destinationName})`;
      destinationSlug = p.destinationSlug;
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        for await (const ev of runConcierge(messages, { pagePath: path, destinationSlug, placeName, user })) {
          send(ev);
          if (req.signal.aborted) break;
        }
      } catch (e) {
        send({ type: "error", message: `Sorry, something went wrong (${(e as Error).message}).` });
        send({ type: "done", provider: "local" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
