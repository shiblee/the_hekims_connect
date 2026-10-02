import { getRequestConfig } from "next-intl/server";
import { getPublishedMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/languages";

export default getRequestConfig(async () => {
  const locale = await getCurrentLocale();
  return { locale, messages: await getPublishedMessages(locale) };
});
