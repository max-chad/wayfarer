import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { quotaSubject } from "@/lib/data/billing";
import { chargeSponsoredClick } from "@/lib/data/business";

/** Sponsored-listing click: verifies the impression token, charges the advertiser's CPC, sends the traveler on. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const user = await getCurrentUser();
  const hit = chargeSponsoredClick(token, quotaSubject(req, user));
  const origin = new URL(req.url).origin;
  const out = NextResponse.redirect(`${origin}${hit ? `/place/${hit.slug}` : "/"}`, 302);
  out.headers.set("x-robots-tag", "noindex");
  return out;
}
