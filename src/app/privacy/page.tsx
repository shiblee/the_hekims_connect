import type { Metadata } from "next";
import { StaticPageShell, MarkdownBody } from "@/components/shared/static-page-shell";
import { getPublishedPageContent } from "@/lib/pages";
import { getCurrentLocale } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "Privacy Policy — The Hekim's Connect",
  description: "How The Hekim's Connect collects, uses, stores and protects your data.",
};

export default async function PrivacyPage() {
  const locale = await getCurrentLocale();
  const content = await getPublishedPageContent("privacy", locale);

  if (!content) {
    return (
      <StaticPageShell eyebrow="Legal" title="Privacy Policy">
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
