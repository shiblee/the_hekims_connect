import { db } from "@/lib/db";

// Defaults for the printed report's branding — every value can be changed in
// Admin → Settings → Clinical Report. The slogan and copyright owner are
// proposals awaiting the platform owner's approval.
export const REPORT_DEFAULTS = {
  portal_name: "The Hekim's Connect",
  website_url: "https://thehekimsconnect.com",
  slogan: "Connecting Knowledge, Care, and the Wisdom of Unani Medicine.",
  report_title: "Comprehensive Patient Assessment Report",
  report_subtitle: "Clinical Assessment and Consultation Summary",
  copyright_owner: "The Hekim's Connect",
  confidentiality: "This document contains confidential patient information and is intended only for authorized healthcare professionals and other permitted recipients. Handle and share it in accordance with applicable privacy and data-protection requirements.",
  insight_disclaimer: "Items marked Hakeem Insight are automated decision support. They are not a diagnosis and do not replace the independent clinical judgement of a qualified practitioner.",
} as const;

export type ReportBranding = Record<keyof typeof REPORT_DEFAULTS, string> & { support_email: string | null; support_phone: string | null };

export async function getReportBranding(): Promise<ReportBranding> {
  const rows = await db.portalSetting.findMany({ where: { category: { in: ["general", "report"] } } });
  const val = (cat: string, key: string) => rows.find((r) => r.category === cat && r.key === key)?.value?.trim() || null;
  const out = {} as ReportBranding;
  for (const k of Object.keys(REPORT_DEFAULTS) as (keyof typeof REPORT_DEFAULTS)[]) {
    out[k] = val("report", k) || (k === "portal_name" ? val("general", "portal_name") : null) || REPORT_DEFAULTS[k];
  }
  out.support_email = val("general", "support_email");
  out.support_phone = val("general", "support_phone");
  return out;
}
