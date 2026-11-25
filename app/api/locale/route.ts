import { fail, ok } from "@/lib/api";
import { LOCALE_COOKIE, LOCALES } from "@/lib/locale-core";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body");
  }
  const { locale } = (body || {}) as { locale?: unknown };
  if (typeof locale !== "string" || !(LOCALES as readonly string[]).includes(locale)) return fail("Unsupported locale", 422);
  const res = ok({ locale });
  // Client-set preference cookie: httpOnly off so the header switcher can also read it; 1 year.
  res.headers.append("Set-Cookie", `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${365 * 86400}; SameSite=Lax`);
  return res;
}
