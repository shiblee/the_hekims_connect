import type { NextRequest } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";

/** "19 Jan 2027" in Indian time — dates in emails shouldn't depend on the server's time zone. */
export const emailDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Values every branded email can use: portal name, support contacts, year and the site address. */
export async function brandEmailVars(req: NextRequest) {
  const [portalName, supportEmail, supportPhone] = await Promise.all([
    getSetting("general", "portal_name", "The Hekim's Connect"),
    getSetting("general", "support_email", "care@hekims.connect"),
    getSetting("general", "support_phone", ""),
  ]);
  const site = getSiteUrl(req);
  return {
    portal_name: portalName, support_email: supportEmail, support_phone: supportPhone || "—",
    year: String(new Date().getFullYear()), site_url: site,
    login_url: `${site}/login/facility`, profile_setup_url: `${site}/facility/profile-setup`, dashboard_url: `${site}/facility/dashboard`,
  };
}

/** "₹999" for INR, otherwise "USD 20". */
export const priceText = (amount: string | number, currency: string) =>
  currency === "INR" ? `₹${Number(amount).toLocaleString("en-IN")}` : `${currency} ${amount}`;
