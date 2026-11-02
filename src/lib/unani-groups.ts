// Unani medicines are listed in three groups, decided by their profile's category
// (SupplementProfile.herbType): Murakkab, Mufrad, and Other for everything else.

export const UNANI_GROUPS = ["murakkab", "mufrad", "other"] as const;
export type UnaniGroup = (typeof UNANI_GROUPS)[number];

/** The category a medicine added directly to a group gets ("other" sets none). */
export const UNANI_GROUP_CATEGORY: Partial<Record<UnaniGroup, string>> = {
  murakkab: "Compound Formulation (Murakkab)",
  mufrad: "Single Herb (Mufrad)",
};

export function unaniGroup(category: string | null | undefined): UnaniGroup {
  return category === UNANI_GROUP_CATEGORY.murakkab ? "murakkab" : category === UNANI_GROUP_CATEGORY.mufrad ? "mufrad" : "other";
}
