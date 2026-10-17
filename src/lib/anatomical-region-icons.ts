import {
  Activity, Apple, Baby, Bone, BrainCircuit, BrainCog, CircleDot, Droplet, Droplets, Ear, Eye, FlaskConical,
  Footprints, Hand, HeartPulse, Mars, Ribbon, Smile, Stethoscope, Venus, Wind, type LucideIcon,
} from "lucide-react";

// Icons an admin can pick for an Anatomical Region & Organ System card
// (AnatomicalRegionTag.icon stores the key). Unknown keys fall back to "activity".
export const ANATOMICAL_REGION_ICONS: Record<string, { label: string; Icon: LucideIcon }> = {
  apple: { label: "Digestive (apple)", Icon: Apple },
  brain: { label: "Brain / nerves", Icon: BrainCog },
  bone: { label: "Bone / joints", Icon: Bone },
  wind: { label: "Breathing (lungs)", Icon: Wind },
  hand: { label: "Skin", Icon: Hand },
  droplet: { label: "Kidney / urinary", Icon: Droplet },
  heart: { label: "Heart / circulation", Icon: HeartPulse },
  eye: { label: "Eye", Icon: Eye },
  ear: { label: "Ear / ENT", Icon: Ear },
  smile: { label: "Mouth / dental", Icon: Smile },
  flask: { label: "Glands / metabolism", Icon: FlaskConical },
  droplets: { label: "Blood / lymph", Icon: Droplets },
  mind: { label: "Mind / psychological", Icon: BrainCircuit },
  dot: { label: "Anorectal", Icon: CircleDot },
  ribbon: { label: "Breast", Icon: Ribbon },
  venus: { label: "Female reproductive", Icon: Venus },
  mars: { label: "Male reproductive", Icon: Mars },
  baby: { label: "Child health", Icon: Baby },
  footprints: { label: "Limbs / feet", Icon: Footprints },
  stethoscope: { label: "General", Icon: Stethoscope },
  activity: { label: "Other", Icon: Activity },
};

export const regionIcon = (key: string | null | undefined): LucideIcon =>
  ANATOMICAL_REGION_ICONS[key || ""]?.Icon ?? Activity;

/** Which patients a region applies to (AnatomicalRegionTag.gender). */
export const REGION_GENDERS = [
  { value: "all", label: "All patients" },
  { value: "female", label: "Female patients only" },
  { value: "male", label: "Male patients only" },
] as const;

/**
 * Whether a region applies to a patient. Only a recorded Male/Female narrows
 * the list — "Other", "Prefer not to say" or no gender shows every region,
 * so nothing relevant is ever hidden.
 */
export function regionAppliesTo(regionGender: string | null | undefined, patientGender: string | null | undefined): boolean {
  const g = (patientGender || "").trim().toLowerCase();
  if (!regionGender || regionGender === "all" || (g !== "male" && g !== "female")) return true;
  return regionGender === g;
}
