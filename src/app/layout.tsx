import type { Metadata } from "next";
import { Geist_Mono, Poppins, PT_Serif, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionBoundary } from "@/components/providers/session-boundary";
import { getEnabledLanguages } from "@/lib/i18n/languages";
import { AREA_NAMESPACES, pickNamespaces } from "@/lib/i18n/app-strings";
import { ApiErrorTranslator } from "@/components/providers/api-error-translator";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Hekim's Connect — Ancient Wisdom, Modern Care",
  description:
    "The Hekim's Connect is a unified Unani medicine platform connecting Facilities and patients. Manage consultations, Mizaj assessment, pharmacy, records and secure messaging.",
  keywords: [
    "Unani medicine",
    "Facility",
    "Hekim",
    "Mizaj assessment",
    "Ilaj-bil-Tadbeer",
    "Hijama",
    "Unani pharmacy",
    "telemedicine",
  ],
  authors: [{ name: "The Hekim's Connect" }],
  openGraph: {
    title: "The Hekim's Connect",
    description: "Ancient Wisdom, Modern Care — Unani medicine platform",
    siteName: "The Hekim's Connect",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, languages, h] = await Promise.all([
    getLocale(),
    getMessages(),
    getEnabledLanguages(),
    headers(),
  ]);
  const area = h.get("x-hekim-area") === "admin" ? AREA_NAMESPACES.admin : AREA_NAMESPACES.public;
  const dir = languages.find((l) => l.code === locale)?.direction ?? "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${geistMono.variable} ${ptSerif.variable} ${notoSansArabic.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <NextIntlClientProvider messages={pickNamespaces(messages, area)}>
          <ApiErrorTranslator />
          <ThemeProvider>
            <SessionBoundary>{children}</SessionBoundary>
          </ThemeProvider>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
