import {
  Activity, Apple, Baby, Bone, BrainCog, Droplet, Ear, Eye, Footprints, Hand, HeartPulse,
  Mars, Smile, Stethoscope, Venus, Wind, type LucideIcon,
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
  venus: { label: "Female reproductive", Icon: Venus },
  mars: { label: "Male reproductive", Icon: Mars },
  baby: { label: "Child health", Icon: Baby },
  footprints: { label: "Limbs / feet", Icon: Footprints },
  stethoscope: { label: "General", Icon: Stethoscope },
  activity: { label: "Other", Icon: Activity },
};

export const regionIcon = (key: string | null | undefined): LucideIcon =>
  ANATOMICAL_REGION_ICONS[key || ""]?.Icon ?? Activity;
