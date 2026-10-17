// Body areas for the Stage 3 Anatomical Region body map. Each region
// (AnatomicalRegionTag.bodyZone) points at one zone; a zone describes what to
// highlight and where its marker sits, per view. Coordinates are in the body
// map's SVG viewBox (0 0 200 420) — see BodyMap in
// src/components/facility/views/anatomical-region-selector.tsx.

export type BodyView = "front" | "back";

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "stroke"; d: string; width: number }
  | { kind: "silhouette" };

interface ZoneView { shapes: Shape[]; marker: { x: number; y: number } }

export interface BodyZone {
  label: string;
  front?: ZoneView;
  back?: ZoneView;
}

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: "ellipse", cx, cy, rx, ry });

// Limb outlines — the same paths the silhouette draws, reused as highlights.
export const LIMB_PATHS = {
  armL: "M64 90 Q50 140 46 190 L42 250",
  armR: "M136 90 Q150 140 154 190 L158 250",
  legL: "M86 246 L82 330 L80 398",
  legR: "M114 246 L118 330 L120 398",
};
const limbs: Shape[] = [
  { kind: "stroke", d: LIMB_PATHS.armL, width: 16 },
  { kind: "stroke", d: LIMB_PATHS.armR, width: 16 },
  { kind: "stroke", d: LIMB_PATHS.legL, width: 22 },
  { kind: "stroke", d: LIMB_PATHS.legR, width: 22 },
];
const joints: Shape[] = [e(100, 68, 11, 9), e(64, 90, 10, 10), e(136, 90, 10, 10), e(83, 330, 10, 11), e(117, 330, 10, 11)];

export const BODY_ZONES: Record<string, BodyZone> = {
  head: { label: "Head / brain", front: { shapes: [e(100, 38, 20, 23)], marker: { x: 112, y: 22 } }, back: { shapes: [e(100, 38, 20, 23)], marker: { x: 100, y: 34 } } },
  mind: { label: "Mind (head)", front: { shapes: [e(100, 32, 18, 16)], marker: { x: 88, y: 22 } }, back: { shapes: [e(100, 32, 18, 16)], marker: { x: 100, y: 18 } } },
  eyes: { label: "Eyes", front: { shapes: [e(91, 36, 6, 4), e(109, 36, 6, 4)], marker: { x: 91, y: 37 } } },
  ent: { label: "Ears, nose & throat", front: { shapes: [e(78, 40, 5, 8), e(122, 40, 5, 8), e(100, 44, 5, 6), e(100, 66, 8, 6)], marker: { x: 122, y: 42 } } },
  mouth: { label: "Mouth & teeth", front: { shapes: [e(100, 52, 8, 5)], marker: { x: 100, y: 53 } } },
  neck: { label: "Neck / thyroid", front: { shapes: [e(100, 68, 10, 8)], marker: { x: 100, y: 70 } } },
  joints: { label: "Neck & joints", front: { shapes: joints, marker: { x: 64, y: 90 } }, back: { shapes: joints, marker: { x: 100, y: 68 } } },
  chest: { label: "Chest / lungs", front: { shapes: [e(83, 112, 15, 24), e(117, 112, 15, 24)], marker: { x: 83, y: 108 } }, back: { shapes: [e(83, 112, 15, 24), e(117, 112, 15, 24)], marker: { x: 83, y: 108 } } },
  heart: { label: "Heart", front: { shapes: [e(109, 120, 11, 12)], marker: { x: 109, y: 120 } } },
  breast: { label: "Breast", front: { shapes: [e(84, 124, 12, 9), e(116, 124, 12, 9)], marker: { x: 116, y: 126 } } },
  upperAbdomen: { label: "Upper abdomen (stomach, liver)", front: { shapes: [e(100, 160, 26, 17)], marker: { x: 100, y: 160 } } },
  lowerAbdomen: { label: "Lower abdomen", front: { shapes: [e(100, 200, 28, 18)], marker: { x: 100, y: 200 } } },
  urinary: { label: "Kidneys & bladder", front: { shapes: [e(100, 232, 15, 9)], marker: { x: 100, y: 230 } }, back: { shapes: [e(86, 188, 9, 13), e(114, 188, 9, 13)], marker: { x: 114, y: 188 } } },
  reproductive: { label: "Pelvis / reproductive", front: { shapes: [e(100, 244, 15, 10)], marker: { x: 100, y: 246 } } },
  spine: { label: "Spine / back", back: { shapes: [{ kind: "stroke", d: "M100 70 L100 238", width: 9 }], marker: { x: 100, y: 150 } } },
  anorectal: { label: "Anorectal", back: { shapes: [e(100, 246, 10, 8)], marker: { x: 100, y: 246 } } },
  limbs: { label: "Arms & legs", front: { shapes: limbs, marker: { x: 46, y: 190 } }, back: { shapes: limbs, marker: { x: 154, y: 190 } } },
  skin: { label: "Skin (whole body)", front: { shapes: [{ kind: "silhouette" }], marker: { x: 154, y: 160 } }, back: { shapes: [{ kind: "silhouette" }], marker: { x: 46, y: 160 } } },
  blood: { label: "Blood & lymph (whole body)", front: { shapes: [{ kind: "silhouette" }], marker: { x: 140, y: 230 } }, back: { shapes: [{ kind: "silhouette" }], marker: { x: 60, y: 230 } } },
  whole: { label: "Whole body", front: { shapes: [{ kind: "silhouette" }], marker: { x: 100, y: 92 } }, back: { shapes: [{ kind: "silhouette" }], marker: { x: 100, y: 92 } } },
};

/** Default body area for the seeded regions, matched by label. */
export const DEFAULT_REGION_ZONES: Record<string, string> = {
  "Gastrointestinal / Hepato-Biliary": "upperAbdomen",
  "Cranial / Neurological": "head",
  "Musculoskeletal / Cervical": "joints",
  "Respiratory / Sadr": "chest",
  "Dermatological / Jild": "skin",
  "Renal / Urinary": "urinary",
  "General / Systemic": "whole",
  "Cardiovascular / Qalb": "heart",
  "Spinal / Back": "spine",
  "Limbs & Peripheral Vessels": "limbs",
  "Ophthalmic / Ayn": "eyes",
  "Ear, Nose & Throat": "ent",
  "Oral & Dental / Fam": "mouth",
  "Endocrine & Metabolic": "neck",
  "Blood & Lymphatic": "blood",
  "Psychological / Nafsani": "mind",
  "Anorectal / Maq'ad": "anorectal",
  "Gynaecological / Rahim": "reproductive",
  "Obstetric / Pregnancy": "lowerAbdomen",
  "Breast / Sadi": "breast",
  "Male Reproductive / Andrological": "reproductive",
};
