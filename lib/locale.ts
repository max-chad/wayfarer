import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "./locale-core";

export * from "./locale-core";

export async function getLocale(): Promise<Locale> {
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
