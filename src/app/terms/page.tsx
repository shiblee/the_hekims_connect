import type { Metadata } from "next";
import { StaticPageShell, MarkdownBody } from "@/components/shared/static-page-shell";
import { getPublishedPageContent } from "@/lib/pages";
import { getCurrentLocale } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Terms & Conditions — The Hekim's Connect",
  description: "The terms that govern use of The Hekim's Connect platform.",
};

export default async function TermsPage() {
  const locale = await getCurrentLocale();
  const content = await getPublishedPageContent("terms", locale);

  if (!content) {
    return (
      <StaticPageShell eyebrow="Legal" title="Terms & Conditions">
        <p className="text-muted-foreground">This page hasn&apos;t been published yet.</p>
      </StaticPageShell>
    );
  }

  return (
    <StaticPageShell eyebrow="Legal" title={content.title} subtitle={content.subtitle ?? undefined}>
      <MarkdownBody body={content.body} />
    </StaticPageShell>
  );
}
