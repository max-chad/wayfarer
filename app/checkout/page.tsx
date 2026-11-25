import { CheckCircle2, CreditCard, Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { getCurrentUser } from "@/lib/auth";
import { activeSubscription, PAYMENTS_MODE } from "@/lib/data/billing";
import { getBusinessByPlace, placeSummary } from "@/lib/data/business";
import { BUSINESS_TIERS, PLUS_FEATURES, PRODUCTS, formatCents, priceFor, type ProductId } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type SP = Promise<{ product?: string; interval?: string; place?: string }>;

export default async function CheckoutPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const productId = (sp.product || "plus") as ProductId;
  const product = PRODUCTS[productId];
  const user = await getCurrentUser();
  const self = `/checkout?product=${productId}&interval=${sp.interval || "month"}${sp.place ? `&place=${sp.place}` : ""}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(self)}`);
  if (!product) redirect("/pricing");

  const interval = sp.interval === "year" && product.yearlyCents ? "year" : "month";
  const price = priceFor(productId, interval);
  const placeId = sp.place ? Number(sp.place) : null;
  const isBusiness = product.audience === "business";
  const biz = isBusiness && placeId ? getBusinessByPlace(placeId) : null;
  const place = placeId ? placeSummary(placeId) : null;
  const problem = isBusiness
    ? !biz || biz.userId !== user.id
      ? "Choose one of your claimed listings to upgrade."
      : biz.status !== "verified"
        ? "Verify your listing before upgrading."
        : null
    : null;
  const existing = activeSubscription(user.id, productId, isBusiness ? placeId : null);
  const renews = new Date();
  if (interval === "year") renews.setUTCFullYear(renews.getUTCFullYear() + 1);
  else renews.setUTCMonth(renews.getUTCMonth() + 1);
  const features = productId === "plus" ? PLUS_FEATURES.filter((f) => f.plus !== f.free).map((f) => f.label) : BUSINESS_TIERS.find((t) => t.product === productId)?.features ?? [product.tagline];

  return (
    <div className="container-page max-w-4xl pt-10">
      <Link href={isBusiness ? "/business#plans" : productId === "api_growth" ? "/developers#pricing" : "/pricing"} className="text-sm text-muted hover:underline">
        ← Back to plans
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Checkout</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1fr_360px]">
        <div className="card p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">You&apos;re subscribing to</div>
          <div className="mt-1 font-display text-2xl font-semibold">{product.name}</div>
          {place && <div className="mt-1 text-sm text-muted">for {place.name}, {place.destinationName}</div>}
          <ul className="mt-5 space-y-2 text-sm">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
                {f}
              </li>
            ))}
          </ul>
          {product.yearlyCents && (
            <div className="mt-6 flex gap-2">
              {(["month", "year"] as const).map((iv) => (
                <Link key={iv} href={`/checkout?product=${productId}&interval=${iv}${placeId ? `&place=${placeId}` : ""}`} className="chip" data-active={interval === iv}>
                  {iv === "month" ? `${formatCents(product.monthlyCents)} monthly` : `${formatCents(product.yearlyCents!)} yearly`}
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="card h-fit p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{interval === "year" ? "Yearly plan" : "Monthly plan"}</span>
            <span className="font-semibold">{formatCents(price)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Tax</span>
            <span className="text-muted">Calculated at payment</span>
          </div>
          <div className="my-4 h-px bg-line" />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Due today</span>
            <span className="font-display text-3xl font-semibold">{formatCents(price)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Renews {formatDate(renews.toISOString().slice(0, 10))} at {formatCents(price)}. Cancel anytime before then.
          </p>

          {PAYMENTS_MODE === "demo" && (
            <div className="mt-4 flex gap-2 rounded-xl bg-sun-300/20 p-3 text-xs leading-relaxed dark:bg-sun-500/10">
              <Info className="mt-0.5 size-4 shrink-0 text-sun-500" />
              <span>
                <strong>Demo mode:</strong> no card is needed and nothing is charged. In production this step hands off to a PCI-compliant payment provider.
              </span>
            </div>
          )}

          <div className="mt-4">
            {problem ? (
              <div className="space-y-3">
                <p className="text-sm text-coral-600">{problem}</p>
                <Link href="/business/dashboard" className="btn btn-outline w-full">
                  Go to your listings
                </Link>
              </div>
            ) : existing && !existing.cancelAtPeriodEnd ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">You already have {product.name}.</p>
                <Link href="/account/billing" className="btn btn-outline w-full">
                  Manage billing
                </Link>
              </div>
            ) : (
              <CheckoutButton product={productId} interval={interval} placeId={placeId} label={existing ? "Resume subscription" : `Start ${product.name}`} />
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Secure checkout
            </span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="size-3.5" /> Cancel anytime
            </span>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">
            By subscribing you agree to the <Link href={isBusiness ? "/legal/business-terms" : "/legal/terms"} className="underline">terms</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
