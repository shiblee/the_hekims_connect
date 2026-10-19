import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AREA_NAMESPACES, pickNamespaces } from "@/lib/i18n/app-strings";
import { FacilityLayoutClient } from "@/components/facility/facility-layout-client";

/** Sends this app's texts, in the visitor's language, to its pages. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={pickNamespaces(messages, AREA_NAMESPACES.clinic)}><FacilityLayoutClient>{children}</FacilityLayoutClient></NextIntlClientProvider>;
}
