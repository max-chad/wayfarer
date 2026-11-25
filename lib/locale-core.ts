import en from "@/lib/messages/en.json";
import ru from "@/lib/messages/ru.json";

export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "wf_locale";

const MESSAGES: Record<Locale, Record<string, unknown>> = { en, ru };

export function normalizeLocale(value: string | undefined | null): Locale {
  const base = value?.split("-")[0].toLowerCase();
  return base && (LOCALES as readonly string[]).includes(base) ? (base as Locale) : "en";
}

function lookup(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** t("nav.plan") with {name} interpolation; falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const pick = (loc: Locale) => lookup(MESSAGES[loc], key);
  const text = (pick(locale) ?? pick("en")) as string | undefined;
  return typeof text === "string" ? interpolate(text, vars) : key;
}

export function translateList(locale: Locale, key: string): string[] {
  const pick = (loc: Locale) => lookup(MESSAGES[loc], key);
  const arr = (pick(locale) ?? pick("en")) as unknown;
  return Array.isArray(arr) ? (arr as string[]) : [];
}

/** CLDR plural pick from a {one, few, many, other} object under key, with {n,...} interpolation. */
export function translatePlural(locale: Locale, key: string, count: number, vars?: Record<string, string | number>): string {
  const pick = (loc: Locale) => lookup(MESSAGES[loc], key) as Record<string, string> | undefined;
  const forms = pick(locale) ?? pick("en");
  if (!forms) return String(count);
  const category = new Intl.PluralRules(locale).select(count);
  return interpolate(forms[category] ?? forms.other ?? String(count), { n: count, ...vars });
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;
export function useT(locale: Locale): TFunc {
  return (key, vars) => translate(locale, key, vars);
}
