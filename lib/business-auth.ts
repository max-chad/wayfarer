import { fail, requireUser } from "./api";
import { ownedBusiness, type BusinessListing } from "./data/business";
import { tierRank, type BusinessTier } from "./plans";
import type { SessionUser } from "./types";

/** Loads a business listing the signed-in user manages, optionally requiring a minimum tier. */
export async function requireBusiness(id: string | number, minTier: BusinessTier = "free"): Promise<{ user: SessionUser; biz: BusinessListing } | { error: Response }> {
  const auth = await requireUser();
  if ("error" in auth) return auth;
  const biz = ownedBusiness(Number(id), auth.user);
  if (!biz) return { error: fail("Listing not found", 404) };
  if (tierRank(biz.tier) < tierRank(minTier)) {
    return { error: fail(`This needs Business ${minTier === "pro" ? "Pro" : "Insights"}.`, 402, { upgrade: true, feature: `business_${minTier}` }) };
  }
  return { user: auth.user, biz };
}
