"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, X, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSelector } from "@/components/shared/language-selector";

const navLinks = [
  { href: "/#features", key: "nav_platform" },
  { href: "/#philosophy", key: "nav_wisdom" },
  { href: "/#how", key: "nav_how" },
  { href: "/#voices", key: "nav_voices" },
];

export function SiteHeader() {
  const t = useTranslations("site_header");
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <BrandLogo size={52} />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-lg font-medium text-muted-foreground">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
                {t(l.key)}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector />
            <ThemeToggle />
            <Button
              size="sm"
              className="group relative overflow-hidden bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all duration-300 hover:scale-105 hover:shadow-[0_0_28px_color-mix(in_oklch,var(--primary)_45%,transparent)] active:scale-95"
              asChild
            >
              <Link href="/register/facility">
                <span className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <span className="relative z-10 flex items-center gap-1">
                  {t("get_started")} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" />
                </span>
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSelector />
            <ThemeToggle />
            <button
              className="p-2 text-foreground"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={t("toggle_menu")}
            >
              {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      {navOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} className="block text-lg font-medium text-muted-foreground">
              {t(l.key)}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="group relative flex-1 overflow-hidden bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all duration-300 active:scale-95"
              asChild
            >
              <Link href="/register/facility" onClick={() => setNavOpen(false)}>
                <span className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <span className="relative z-10 flex items-center justify-center gap-1">
                  {t("get_started")} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" />
                </span>
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
