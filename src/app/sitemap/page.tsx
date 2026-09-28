import type { Metadata } from "next";
import Link from "next/link";
import { StaticPageShell, StaticSection } from "@/components/shared/static-page-shell";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Sitemap — The Hekim's Connect",
  description: "Every page and section of The Hekim's Connect in one place.",
};

const groups: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Main",
    links: [
      { label: "Home", href: "/" },
      { label: "Platform (features)", href: "/#features" },
      { label: "Unani Wisdom (the Four Akhlat)", href: "/#philosophy" },
      { label: "How it Works", href: "/#how" },
      { label: "Voices (testimonials)", href: "/#voices" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Sitemap", href: "/sitemap" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <StaticPageShell
      eyebrow="Sitemap"
      title="Every page, in one place"
      subtitle="A quick index of everything on The Hekim's Connect."
    >
      <div className="grid sm:grid-cols-2 gap-10">
        {groups.map((g) => (
          <StaticSection key={g.heading} heading={g.heading}>
            <ul className="space-y-2.5 not-prose">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group inline-flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </StaticSection>
        ))}
      </div>

      <StaticSection heading="In-app portals">
        <p>
          The Hakim and Patient dashboards, sign-up, sign-in and OTP verification live inside the
          main app experience rather than as separate URLs. Use <strong>Sign In</strong> or{" "}
          <strong>Get Started</strong> from the homepage header to reach them.
        </p>
      </StaticSection>
    </StaticPageShell>
  );
}
