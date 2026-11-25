// Regression net for the locale helpers (no DB needed): fallback chain, interpolation, Russian CLDR plurals.
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLocale, translate, translateList, translatePlural } from "../lib/locale-core";

test("normalizeLocale falls back to en on unknown input", () => {
  assert.equal(normalizeLocale("ru"), "ru");
  assert.equal(normalizeLocale("ru-RU"), "ru");
  assert.equal(normalizeLocale("EN-us"), "en");
  assert.equal(normalizeLocale("xx"), "en");
  assert.equal(normalizeLocale(undefined), "en");
});

test("translate: RU strings, English fallback, var interpolation, key passthrough", () => {
  assert.match(translate("ru", "home.heroH1"), /умнее/);
  assert.equal(translate("ru", "nav.destinations"), "Направления");
  assert.equal(translate("en", "auth.password"), "Password");
  assert.match(translate("ru", "footer.ai", { label: "Claude" }), /ИИ: Claude/);
  assert.equal(translate("ru", "nope.nothere"), "nope.nothere");
});

test("translatePlural picks Russian CLDR one/few/many forms", () => {
  const key = "home.rainyDaysPlural";
  assert.equal(translatePlural("ru", key, 1), "1 дождливый день");
  assert.equal(translatePlural("ru", key, 3), "3 дождливых дня");
  assert.equal(translatePlural("ru", key, 5), "5 дождливых дней");
  assert.equal(translatePlural("ru", key, 21), "21 дождливый день");
  assert.equal(translatePlural("en", key, 2), "2 rainy days");
});

test("translateList returns full dictionaries", () => {
  const months = translateList("ru", "months");
  assert.equal(months.length, 12);
  assert.equal(months[0], "январь");
  assert.deepEqual(translateList("en", "footer.legal"), ["Terms", "Privacy", "Cookies", "Review guidelines", "Business terms"]);
});

test("ru and en dictionaries have identical key shapes", async () => {
  const en = (await import("../lib/messages/en.json")).default;
  const ru = (await import("../lib/messages/ru.json")).default;
  const pluralForms = new Set(["one", "few", "many", "other", "two", "zero"]);
  const leaves = (o: unknown, path = ""): string[] => {
    if (typeof o === "string") return [path];
    if (Array.isArray(o)) return [path + "[]"];
    const rec = o as Record<string, unknown>;
    // Plural-form objects legitimately differ per language (en: one/other; ru: one/few/many/other).
    if (Object.keys(rec).length > 0 && Object.keys(rec).every((k) => pluralForms.has(k))) return [path + "#plural"];
    return Object.entries(rec).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  };
  assert.deepEqual(leaves(ru).sort(), leaves(en).sort());
});
