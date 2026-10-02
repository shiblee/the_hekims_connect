import { db } from "@/lib/db";

export interface PublishedPageContent {
  title: string;
  subtitle: string | null;
  body: string;
  languageCode: string;
}

/** Published content for a page in the given locale, falling back to English if that locale isn't translated/published yet. */
export async function getPublishedPageContent(slug: string, locale: string): Promise<PublishedPageContent | null> {
  const page = await db.page.findUnique({
    where: { slug },
    include: { contents: { where: { status: "published" } } },
  });
  if (!page) return null;

  const match = page.contents.find((c) => c.languageCode === locale) ?? page.contents.find((c) => c.languageCode === "en");
  if (!match) return null;

  return { title: match.title, subtitle: match.subtitle, body: match.body, languageCode: match.languageCode };
}
