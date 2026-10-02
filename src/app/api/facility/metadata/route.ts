import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { getSetting } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sectionRows = await db.metadataSection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });

  const sections: Record<string, { label: string; options: string[] }> = {};
  for (const s of sectionRows) {
    sections[s.key] = { label: s.label, options: s.options.map((o) => o.label) };
  }

  const [trialMonths, price, currency] = await Promise.all([
    getSetting("subscription", "free_trial_months", "3"),
    getSetting("subscription", "paid_plan_price_per_month", "999"),
    getSetting("subscription", "currency", "INR"),
  ]);

  return NextResponse.json({
    sections,
    subscription: { trialMonths: parseInt(trialMonths, 10) || 3, price: parseInt(price, 10) || 0, currency },
  });
}
