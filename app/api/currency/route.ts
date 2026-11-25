import { fail, ok } from "@/lib/api";
import { convertCurrency, getRates } from "@/lib/services/currency";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = (sp.get("from") || "USD").toUpperCase();
  const to = (sp.get("to") || "EUR").toUpperCase();
  const amount = Number(sp.get("amount") || 1);
  if (sp.get("list") === "1") {
    const r = await getRates();
    return ok({ currencies: Object.keys(r.rates).sort(), source: r.source, updated: r.updated });
  }
  if (!Number.isFinite(amount)) return fail("Invalid amount");
  const r = await convertCurrency(amount, from, to);
  return r ? ok(r) : fail("Unsupported currency", 404);
}
