// Starting configuration for the Tashkhees engine — organ links and
// morbid-matter (Maddi) signs. Applied add-only: an organ that already has
// links, or an option that already has a Maddi weight, is never overwritten.
// Both are reviewed and adjusted by the clinical team in Admin.

import type { AppliesTo } from "@/lib/dalail-engine";

const GEN = "General / Constitutional", DIG = "Digestive", RESP = "Respiratory", CARD = "Cardiac", URI = "Urinary",
  SKIN = "Skin", MSK = "Musculoskeletal", NEURO = "Neurological & Mental Health", ENT = "ENT & Eye", GYN = "Gynae & Reproductive";

export const ORGAN_LINKS: Record<string, { appliesTo: AppliesTo; priority: number }> = {
  Dimagh: { appliesTo: { categories: [NEURO], symptoms: ["Headache", "Heaviness of the head", "Dizziness / vertigo", "Forgetfulness", "Excessive drowsiness / oversleeping"], regions: ["Cranial / Neurological", "Psychological / Nafsani"] }, priority: 4 },
  "A'sab": { appliesTo: { categories: [NEURO], symptoms: ["Tingling or numbness", "Tremor", "Muscle cramps"], regions: ["Cranial / Neurological", "Spinal / Back", "Limbs & Peripheral Vessels"] }, priority: 3 },
  Qalb: { appliesTo: { categories: [CARD], symptoms: ["Palpitations", "Heaviness in the chest", "Swelling of the feet", "Breathlessness on exertion"], regions: ["Cardiovascular / Qalb"] }, priority: 4 },
  Riya: { appliesTo: { categories: [RESP], symptoms: ["Dry cough", "Cough with phlegm", "Wheezing", "Breathlessness on exertion"], regions: ["Respiratory / Sadr"] }, priority: 4 },
  Meda: { appliesTo: { categories: [DIG], symptoms: ["Indigestion", "Nausea", "Vomiting", "Belching", "Loss of appetite", "Sour taste in mouth", "Hiccups"], regions: ["Gastrointestinal / Hepato-Biliary"] }, priority: 4 },
  Kabid: { appliesTo: { categories: [DIG], symptoms: ["Yellowish eyes", "Yellowish skin", "Dark yellow / high-coloured urine", "Loss of appetite"], regions: ["Gastrointestinal / Hepato-Biliary", "Blood & Lymphatic"] }, priority: 3 },
  Mirarah: { appliesTo: { symptoms: ["Yellowish eyes", "Yellowish skin", "Sour taste in mouth"], regions: ["Gastrointestinal / Hepato-Biliary"] }, priority: 2 },
  Tihal: { appliesTo: { symptoms: ["Low mood / sadness", "Dry skin"], regions: ["Blood & Lymphatic"] }, priority: 2 },
  Ama: { appliesTo: { categories: [DIG], symptoms: ["Constipation", "Loose stools", "Abdominal cramps", "Bloating / gas", "Undigested food in stool"], regions: ["Gastrointestinal / Hepato-Biliary", "Anorectal / Maq'ad"] }, priority: 4 },
  Kulya: { appliesTo: { categories: [URI], symptoms: ["Reduced urine", "Swelling of the feet", "Back pain"], regions: ["Renal / Urinary"] }, priority: 3 },
  Masana: { appliesTo: { categories: [URI], symptoms: ["Burning on passing urine", "Frequent urination", "Passing urine at night"], regions: ["Renal / Urinary"] }, priority: 3 },
  Rahim: { appliesTo: { categories: [GYN], symptoms: ["Painful periods", "Irregular periods", "Heavy periods", "White discharge"], regions: ["Gynaecological / Rahim", "Obstetric / Pregnancy"], sex: "female" }, priority: 4 },
  Unsayain: { appliesTo: { regions: ["Male Reproductive / Andrological"], sex: "male" }, priority: 3 },
  Jild: { appliesTo: { categories: [SKIN], symptoms: ["Itching", "Skin rash / hives", "Dry skin", "Boils / pimples", "Hair fall"], regions: ["Dermatological / Jild"] }, priority: 4 },
  Mafasil: { appliesTo: { categories: [MSK], symptoms: ["Joint pain", "Joint stiffness", "Back pain"], regions: ["Musculoskeletal / Cervical", "Spinal / Back", "Limbs & Peripheral Vessels"] }, priority: 4 },
  Ayn: { appliesTo: { symptoms: ["Redness of the eyes", "Watery eyes", "Blurred vision", "Yellowish eyes"], regions: ["Ophthalmic / Ayn"] }, priority: 3 },
  Uzn: { appliesTo: { symptoms: ["Ringing in the ears"], regions: ["Ear, Nose & Throat"] }, priority: 2 },
  Halq: { appliesTo: { categories: [ENT], symptoms: ["Sore throat", "Hoarse voice"], regions: ["Ear, Nose & Throat", "Oral & Dental / Fam"] }, priority: 3 },
};
// Keep the General category from claiming every organ — it is intentionally not linked above.
void GEN;

/** section|question|option → morbid-matter (Maddi) weight. */
export const MADDI_SIGNS: Record<string, number> = {
  "lisan|Coating (Ghisha)|Yellow fur": 1,
  "lisan|Coating (Ghisha)|Thick white coat": 1.5,
  "lisan|Coating (Ghisha)|Dark / blackish coat": 1.5,
  "lisan|Tongue edges — teeth marks|Marked teeth marks": 0.5,
  "baul|Qiwam (Consistency)|Ghaleez (Thick, turbid)": 1.5,
  "baul|Rasub (Sediment)|Mucoid / slimy": 1,
  "baul|Rasub (Sediment)|Dark / blackish": 1,
  "baul|Rasub (Sediment)|Reddish / sandy": 0.5,
  "baul|Raiha (Odour)|Foul (Ufoonat — putrefaction)": 1,
  "baraz|Qiwam (Consistency)|Mucoid / slimy": 1,
  "baraz|Raiha (Odour)|Very foul": 1,
  "baraz|Undigested food in stool (Zalaq-ul-Am'a)|Yes": 0.5,
  "nabz|Imtila-o-Khala (Fullness)|Mumtali (Full)": 1,
  "naftha|Sputum consistency|Thick, sticky (Ghaleez)": 1,
  "zahiri|Swelling of feet or ankles (Waram)|Pitting swelling": 1,
};
