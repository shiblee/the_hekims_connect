"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/shared/site-footer";

export function StaticPageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-10">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center">
              <BrandLogo size={36} />
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-4 text-lg text-muted-foreground max-w-2xl">{subtitle}</p>}
        </div>
      </section>

      <section className="relative flex-1 pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10">{children}</div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function StaticSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">{heading}</h2>
      <div className="space-y-3 text-base text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-medium">
        {children}
      </div>
    </div>
  );
}
