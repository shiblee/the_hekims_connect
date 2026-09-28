"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  Mail,
  Phone,
  MapPin,
  Shield,
  Eye,
  Wallet,
  ArrowUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const platformLinks = [
  { key: "link_for_hakims", href: "/#how" },
  { key: "link_for_patients", href: "/#how" },
  { key: "link_mizaj", href: "/#features" },
  { key: "link_pharmacy", href: "/#features" },
  { key: "link_messaging", href: "/#features" },
];

const wisdomLinks = [
  { key: "link_tadbeer", href: "/#philosophy" },
  { key: "link_ghadha", href: "/#philosophy" },
  { key: "link_dawa", href: "/#philosophy" },
  { key: "link_yad", href: "/#philosophy" },
  { key: "link_akhlat", href: "/#philosophy" },
];

const companyLinks = [
  { key: "link_about", href: "/about" },
  { key: "link_privacy_policy", href: "/privacy" },
  { key: "link_terms", href: "/terms" },
  { key: "link_sitemap", href: "/sitemap" },
];

const paymentMethods = [
  { label: "Visa", src: "/payments/visa.svg" },
  { label: "Mastercard", src: "/payments/mastercard.svg" },
  { label: "RuPay", src: "/payments/rupay.svg" },
  { label: "UPI", src: "/payments/upi.svg" },
  { label: "Net Banking", icon: Wallet },
];

function useVisitorCount() {
  const [target, setTarget] = useState<number | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/visitors", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && typeof d.count === "number") setTarget(d.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (target == null) return;
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return target == null ? null : display;
}

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-base text-muted-foreground transition-colors duration-200 hover:text-primary"
      >
        <span className="relative">
          {label}
          <span className="absolute -bottom-0.5 start-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-0 -translate-x-1 rtl:translate-x-1 rtl:rotate-180 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
      </Link>
    </li>
  );
}

export function SiteFooter() {
  const t = useTranslations("site_footer");
  const visitors = useVisitorCount();

  return (
    <footer className="relative mt-auto border-t border-border bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* top accent glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="absolute -top-24 start-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -top-24 end-1/4 h-64 w-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 pt-14 pb-8">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex">
              <BrandLogo size={56} />
            </Link>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-sm">
              {t("tagline")}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-base text-primary">
                <Shield className="h-4 w-4" /> {t("hipaa_badge")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-base text-muted-foreground">
                <Eye className="h-4 w-4 text-accent" />
                {visitors == null ? (
                  <span className="inline-block h-3.5 w-16 animate-pulse rounded bg-muted-foreground/20" />
                ) : (
                  <span className="tabular-nums">{t("visitors_served", { count: visitors.toLocaleString() })}</span>
                )}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xl font-serif font-semibold text-foreground mb-4">{t("col_platform")}</h4>
            <ul className="space-y-2.5">
              {platformLinks.map((l) => (
                <FooterLink key={l.key} label={t(l.key)} href={l.href} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xl font-serif font-semibold text-foreground mb-4">{t("col_wisdom")}</h4>
            <ul className="space-y-2.5">
              {wisdomLinks.map((l) => (
                <FooterLink key={l.key} label={t(l.key)} href={l.href} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xl font-serif font-semibold text-foreground mb-4">{t("col_company")}</h4>
            <ul className="space-y-2.5">
              {companyLinks.map((l) => (
                <FooterLink key={l.key} label={t(l.key)} href={l.href} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xl font-serif font-semibold text-foreground mb-4">{t("col_contact")}</h4>
            <ul className="space-y-3 text-base text-muted-foreground">
              <li>
                <a href="mailto:care@hekims.connect" className="flex items-center gap-2 transition-colors hover:text-primary">
                  <Mail className="h-4 w-4 text-primary shrink-0" /> care@hekims.connect
                </a>
              </li>
              <li>
                <a href="tel:+919876543210" className="flex items-center gap-2 transition-colors hover:text-primary">
                  <Phone className="h-4 w-4 text-primary shrink-0" /> +91 98765 43210
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary shrink-0" /> {t("contact_address")}
              </li>
            </ul>
          </div>
        </div>

        {/* Payments + App badges */}
        <div className="mt-12 grid gap-8 sm:grid-cols-2 border-t border-border pt-8">
          <div>
            <p className="text-base font-medium text-foreground mb-3">{t("we_accept")}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {paymentMethods.map((p) => (
                <span
                  key={p.label}
                  title={p.label}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-3 shadow-sm transition-transform duration-200 hover:scale-105 hover:shadow-md"
                >
                  {p.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.src} alt={p.label} className="h-5 w-auto object-contain" />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700">
                      {p.icon && <p.icon className="h-4 w-4" />} {p.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="sm:text-end">
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              {[
                { src: "/badges/app-store-badge.svg", alt: "Download on the App Store" },
                { src: "/badges/google-play-badge.png", alt: "Get it on Google Play" },
              ].map((b) => (
                <span
                  key={b.src}
                  className="relative inline-flex h-10 items-center cursor-default opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                  title={t("coming_soon")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.src} alt={b.alt} className="h-full w-auto object-contain" />
                  <span className="absolute -top-2 -end-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-foreground shadow">
                    {t("coming_soon")}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-5">
          <p className="text-base text-muted-foreground text-center sm:text-start">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-primary">{t("privacy")}</Link>
            <Link href="/terms" className="transition-colors hover:text-primary">{t("terms")}</Link>
            <Link href="/sitemap" className="transition-colors hover:text-primary">{t("sitemap")}</Link>
          </div>
        </div>
      </div>

      <BackToTop />
    </footer>
  );
}

function BackToTop() {
  const t = useTranslations("site_footer");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      aria-label={t("back_to_top")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-card/90 text-primary backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-110 hover:bg-primary hover:text-primary-foreground",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
