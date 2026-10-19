import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getPublishedMessages } from "@/lib/i18n/messages";
import { DEFAULT_LOCALE, getCurrentLocale } from "@/lib/i18n/languages";

export default getRequestConfig(async () => {
  // The admin panel stays in English whatever language the visitor picked elsewhere.
  const locale = (await headers()).get("x-hekim-area") === "admin" ? DEFAULT_LOCALE : await getCurrentLocale();
  return { locale, messages: await getPublishedMessages(locale) };
});
