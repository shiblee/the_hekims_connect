// One-off: adds the "Referral Decline Reasons" Meta list (Admin → Meta) with its starting options.
// Safe to re-run — does nothing if the list already exists, so admin edits are never touched.
import { db } from "../src/lib/db";
import { REFERRAL_DECLINE_SECTION as S } from "../src/lib/referral-decline";

async function main() {
  const existing = await db.metadataSection.findUnique({ where: { key: S.key } });
  if (existing) { console.log(`"${S.label}" already exists — nothing to do`); return; }
  const max = await db.metadataSection.aggregate({ _max: { sortOrder: true } });
  await db.metadataSection.create({
    data: {
      key: S.key, label: S.label, category: S.category, sortOrder: (max._max.sortOrder ?? -1) + 1,
      options: { create: S.options.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  console.log(`Added "${S.label}" with ${S.options.length} options`);
}

main().finally(() => db.$disconnect());
