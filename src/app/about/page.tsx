import type { Metadata } from "next";
import { StaticPageShell, MarkdownBody } from "@/components/shared/static-page-shell";
import { getPublishedPageContent } from "@/lib/pages";
import { getCurrentLocale } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "About Us — The Hekim's Connect",
  description: "The story, mission and values behind The Hekim's Connect — a unified Unani medicine platform.",
};

export default async function AboutPage() {
  const locale = await getCurrentLocale();
  const content = await getPublishedPageContent("about", locale);

  if (!content) {
    return (
      <StaticPageShell eyebrow="About Us" title="About Us">
        <p className="text-muted-foreground">This page hasn&apos;t been published yet.</p>
      </StaticPageShell>
    );
  }

  return (
    <StaticPageShell eyebrow="About Us" title={content.title} subtitle={content.subtitle ?? undefined}>
      <MarkdownBody body={content.body} />
    </StaticPageShell>
  );
}
