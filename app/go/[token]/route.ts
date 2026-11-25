import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { quotaSubject } from "@/lib/data/billing";
import { recordClickout, type ClickoutPayload } from "@/lib/data/commerce";
import { verifyToken } from "@/lib/sign";

/**
 * Partner click-out: verifies the signed offer, records the CPC click and redirects. Demo partners
 * land on an internal hand-off page; Book Direct links go to the hotel's own booking engine.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const origin = new URL(req.url).origin;
  const payload = verifyToken<ClickoutPayload & Record<string, unknown>>(token);
  if (!payload) return NextResponse.redirect(`${origin}/partners/expired`, 302);
  const user = await getCurrentUser();
  // Only attribute the click to an account when the visitor allowed analytics cookies.
  const consent = (await cookies()).get("wf_consent")?.value === "all";
  recordClickout(payload, quotaSubject(req, user), consent && user ? user.id : null);
  if (payload.pk === "direct" && typeof payload.u === "string" && /^https:\/\//.test(payload.u)) {
    return NextResponse.redirect(payload.u, 302);
  }
  const target = new URL(`/partners/${payload.pk}`, origin);
  target.searchParams.set("t", token);
  const out = NextResponse.redirect(target, 302);
  out.headers.set("x-robots-tag", "noindex");
  return out;
}
