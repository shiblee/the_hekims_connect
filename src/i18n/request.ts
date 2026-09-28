import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getPublishedMessages } from "@/lib/i18n/messages";
import { getEnabledLanguages, DEFAULT_LOCALE } from "@/lib/i18n/languages";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get("NEXT_LOCALE")?.value;
  const enabled = await getEnabledLanguages();
  const fallback = enabled.find((l) => l.isDefault)?.code ?? DEFAULT_LOCALE;
  const locale = requested && enabled.some((l) => l.code === requested) ? requested : fallback;

  return { locale, messages: await getPublishedMessages(locale) };
});
