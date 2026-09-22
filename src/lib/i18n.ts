/**
 * Lightweight i18n layer (Indonesian-first, i18n-ready).
 *
 * Messages live in /messages/<locale>.json. Today we ship `id`. To add a
 * language, drop e.g. /messages/en.json and register it in `catalogs` below;
 * the rest of the app already reads strings through `t()`, so no component
 * changes are required. This is intentionally dependency-free so it works in
 * both Server and Client Components; a buyer who wants routed locales can later
 * swap this for next-intl without changing call sites much.
 */
import { brand } from "../../config/brand";
import id from "../../messages/id.json";

type Messages = typeof id;

const catalogs: Record<string, Messages> = {
  id,
};

export function getMessages(locale: string = brand.defaultLocale): Messages {
  return catalogs[locale] ?? catalogs[brand.defaultLocale] ?? id;
}

/** Resolve a dotted key path like "wizard.characterTitle". */
function resolve(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/** Interpolate {placeholders} in a string with values. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

/**
 * Translate a dotted key. Returns the key itself if missing (so gaps are
 * visible rather than silently blank).
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: string = brand.defaultLocale
): string {
  const val = resolve(getMessages(locale), key);
  if (typeof val === "string") return interpolate(val, vars);
  return key;
}

/** Fetch an array message (e.g. fun facts) for random selection. */
export function tArray(key: string, locale: string = brand.defaultLocale): string[] {
  const val = resolve(getMessages(locale), key);
  return Array.isArray(val) ? (val as string[]) : [];
}
