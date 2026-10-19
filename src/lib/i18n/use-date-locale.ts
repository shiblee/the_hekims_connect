import { useLocale, useTranslations } from "next-intl";

/** Locale for dates and times in the user's language, keeping Western digits (e.g. "ar-u-nu-latn"). */
export function useDateLocale(): string {
  const locale = useLocale();
  return locale === "en" ? "en-IN" : `${locale}-u-nu-latn`;
}

/** A stored option value (e.g. "Male") in the user's language, or as stored when there's no label for it. */
export function useValueLabel(): (value: string | null | undefined) => string {
  const t = useTranslations("common.values");
  return (value) => (!value ? "" : t.has(value) ? t(value) : value);
}

/** "a, b and c" in the user's language. */
export function useListFormat(): (items: string[]) => string {
  const dl = useDateLocale();
  return (items) => new Intl.ListFormat(dl, { type: "conjunction" }).format(items);
}
