// Usool-e-Ilaj (principles of treatment) — conditions for the existing
// principles, plus a starter set of further classical principles. Existing
// principles stay approved and only gain conditions (where none are set). New
// ones are DRAFTS, hidden from doctors until a physician approves them in
// Admin → Meta → Tashkhees & Ilaj → Usool-e-Ilaj. Cautions mark situations in
// which a principle needs particular care (e.g. evacuation with a weak pulse).

import type { UsoolRule } from "@/lib/usool-engine";

const DIG = "Digestive", RESP = "Respiratory", CARD = "Cardiac", URI = "Urinary", SKIN = "Skin", MSK = "Musculoskeletal",
  NEURO = "Neurological & Mental Health", ENT = "ENT & Eye", GYN = "Gynae & Reproductive";
const WEAK = ["Za'eef (Weak)", "Yes — very weak, thready", "Marked pallor", "Visible wasting"];
const PREG = ["Obstetric / Pregnancy"];
const PAIN = ["Headache", "Joint pain", "Back pain", "Abdominal cramps", "Body ache", "Painful periods", "Muscle cramps"];

export const EXISTING_USOOL: Record<string, { rule: UsoolRule; priority: number }> = {
  "Izala-e-Sabab": { rule: { always: true, phase: 1 }, priority: 5 },
  "Islah-e-Asbab-e-Sitta": { rule: { always: true, phase: 1 }, priority: 4 },
  "Tasheeh-e-Ghiza": { rule: { always: true, categories: [DIG], phase: 1 }, priority: 4 },
  "Tadeel-e-Mizaj": { rule: { type: "Sada", phase: 4 }, priority: 5 },
  "Munzij-Mushil therapy": { rule: { type: "Maddi", minDarja: 2, phase: 2, avoidIf: [...WEAK, ...PREG], cautionBelowAge: 12, cautionAboveAge: 70 }, priority: 5 },
  "Istifragh-e-Mawad": { rule: { type: "Maddi", phase: 3, avoidIf: [...WEAK, ...PREG], cautionBelowAge: 12, cautionAboveAge: 70 }, priority: 4 },
  "Imala-e-Mawad": { rule: { type: "Maddi", categories: [NEURO, ENT], symptoms: ["Headache", "Heaviness of the head"], phase: 3 }, priority: 2 },
  "Taqwiyat-e-Aza": { rule: { organs: ["*"], phase: 5 }, priority: 4 },
  "Taskeen-e-Alam": { rule: { symptoms: PAIN, phase: 6 }, priority: 3 },
};

export const NEW_USOOL: { label: string; localName?: string; description: string; rule: UsoolRule; priority: number }[] = [
  // Tadeel-e-Mizaj by opposites (Ilaj bil Zid) — Sada
  { label: "Tabreed", localName: "تبرید", description: "Cooling — for hot (Haar) dyscrasias", rule: { mizaj: ["Safrawi", "Damawi", "Haar"], phase: 4 }, priority: 4 },
  { label: "Taskheen", localName: "تسخین", description: "Warming — for cold (Barid) dyscrasias", rule: { mizaj: ["Balghami", "Saudawi", "Barid"], phase: 4 }, priority: 4 },
  { label: "Tarteeb", localName: "ترطیب", description: "Moistening — for dry (Yabis) dyscrasias", rule: { mizaj: ["Safrawi", "Saudawi", "Yabis"], phase: 4 }, priority: 3 },
  { label: "Tajfeef", localName: "تجفیف", description: "Drying — for moist (Ratab) dyscrasias", rule: { mizaj: ["Balghami", "Damawi", "Ratab"], phase: 4 }, priority: 3 },

  // Nuzj (concoction) of the specific humour — Maddi
  { label: "Nuzj-e-Safra", description: "Concoction of Safra with Munzij-e-Safra before evacuation", rule: { type: "Maddi", mizaj: ["Safrawi"], phase: 2 }, priority: 5 },
  { label: "Nuzj-e-Balgham", description: "Concoction of Balgham with Munzij-e-Balgham before evacuation", rule: { type: "Maddi", mizaj: ["Balghami"], phase: 2 }, priority: 5 },
  { label: "Nuzj-e-Sauda", description: "Concoction of Sauda with Munzij-e-Sauda before evacuation", rule: { type: "Maddi", mizaj: ["Saudawi"], phase: 2 }, priority: 5 },
  { label: "Nuzj-e-Dam", description: "Correction of thickened blood (Dam) before evacuation", rule: { type: "Maddi", mizaj: ["Damawi"], phase: 2 }, priority: 3 },

  // Istifragh (evacuation) routes — Maddi
  { label: "Ishal (Tanqiya by purgation)", description: "Evacuation of the morbid humour through the bowel (Mushil)", rule: { type: "Maddi", minDarja: 2, phase: 3, avoidIf: [...WEAK, ...PREG, "Loose stools"], cautionBelowAge: 12, cautionAboveAge: 70 }, priority: 4 },
  { label: "Qai (emesis)", description: "Evacuation of Balgham from the stomach by emesis", rule: { type: "Maddi", mizaj: ["Balghami"], organs: ["Meda"], phase: 3, avoidIf: [...WEAK, ...PREG, CARD, "Vomiting"], cautionAboveAge: 60 }, priority: 2 },
  { label: "Fasd (venesection)", description: "Evacuation of excess Dam by venesection", rule: { type: "Maddi", mizaj: ["Damawi"], minDarja: 2, phase: 3, avoidIf: [...WEAK, ...PREG, "Pale skin", "General weakness"], cautionBelowAge: 14, cautionAboveAge: 65 }, priority: 3 },
  { label: "Hijama (cupping)", description: "Local evacuation of Dam and morbid matter by cupping", rule: { mizaj: ["Damawi", "Saudawi", "Safrawi"], categories: [MSK, NEURO, SKIN], phase: 3, avoidIf: [...WEAK, ...PREG], cautionBelowAge: 12 }, priority: 3 },
  { label: "Taleeq (leech therapy)", description: "Local evacuation of thick blood by leeches", rule: { mizaj: ["Damawi", "Saudawi"], categories: [SKIN, MSK], phase: 3, avoidIf: [...WEAK, ...PREG] }, priority: 2 },
  { label: "Idrar-e-Baul (diuresis)", description: "Evacuation through the urine", rule: { organs: ["Kulya", "Masana"], categories: [URI], symptoms: ["Reduced urine", "Swelling of the feet"], phase: 3, avoidIf: ["Severe dehydration — no urine for 12 hours, sunken eyes, very dry mouth"] }, priority: 3 },
  { label: "Tareeq (diaphoresis)", description: "Evacuation through sweat in fevers and cold conditions", rule: { symptoms: ["Chills with fever (rigors)", "Body ache"], mizaj: ["Balghami", "Barid"], phase: 3, avoidIf: WEAK }, priority: 2 },
  { label: "Hoqna (enema)", description: "Evacuation from the lower bowel", rule: { organs: ["Ama"], symptoms: ["Constipation"], phase: 3, avoidIf: [...PREG, "Loose stools"] }, priority: 2 },
  { label: "Tasheel (gentle laxation)", description: "Mild softening of the stool without full purgation", rule: { symptoms: ["Constipation"], organs: ["Ama"], phase: 3, avoidIf: ["Loose stools"] }, priority: 3 },
  { label: "Tanqiya-e-Dimagh", description: "Clearing the head of morbid matter (Nazla, Zukam)", rule: { categories: [ENT, NEURO], symptoms: ["Runny nose", "Blocked nose", "Heaviness of the head"], type: "Maddi", phase: 3 }, priority: 2 },
  { label: "Tasfiya-e-Dam", description: "Purification of the blood", rule: { categories: [SKIN], mizaj: ["Damawi", "Saudawi", "Safrawi"], phase: 3 }, priority: 3 },
  { label: "Tafteeh-e-Sudad", description: "Removal of obstructions (liver, gall bladder, kidney)", rule: { organs: ["Kabid", "Mirarah", "Kulya", "Tihal"], phase: 3 }, priority: 3 },

  // Taqwiyat (strengthening) of specific organs
  { label: "Taqwiyat-e-Meda", description: "Strengthening the stomach and digestion", rule: { organs: ["Meda"], categories: [DIG], phase: 5 }, priority: 4 },
  { label: "Taqwiyat-e-Kabid", description: "Strengthening the liver", rule: { organs: ["Kabid", "Mirarah"], phase: 5 }, priority: 4 },
  { label: "Taqwiyat-e-Qalb", description: "Strengthening the heart (Muqawwi-e-Qalb)", rule: { organs: ["Qalb"], categories: [CARD], symptoms: ["Palpitations"], phase: 5 }, priority: 4 },
  { label: "Taqwiyat-e-Dimagh", description: "Strengthening the brain", rule: { organs: ["Dimagh"], categories: [NEURO], symptoms: ["Forgetfulness", "Headache"], phase: 5 }, priority: 4 },
  { label: "Taqwiyat-e-A'sab", description: "Strengthening the nerves", rule: { organs: ["A'sab"], symptoms: ["Tingling or numbness", "Tremor"], phase: 5 }, priority: 3 },
  { label: "Taqwiyat-e-Riya", description: "Strengthening the lungs", rule: { organs: ["Riya"], categories: [RESP], phase: 5 }, priority: 3 },
  { label: "Taqwiyat-e-Gurda", description: "Strengthening the kidneys and bladder", rule: { organs: ["Kulya", "Masana"], categories: [URI], phase: 5 }, priority: 3 },
  { label: "Taqwiyat-e-Rahim", description: "Strengthening the uterus", rule: { organs: ["Rahim"], categories: [GYN], sex: "female", phase: 5 }, priority: 3 },
  { label: "Taqwiyat-e-Badan", description: "General strengthening of the body and its faculties (Quwa)", rule: { symptoms: ["General weakness", "Tiredness / fatigue", "Unintended weight loss"], phase: 5 }, priority: 3 },

  // Symptomatic and regulating principles
  { label: "Tahleel-e-Waram", description: "Resolving swelling and inflammation", rule: { symptoms: ["Swelling of the feet", "Joint pain"], categories: [MSK, SKIN], phase: 6 }, priority: 3 },
  { label: "Rade-o-Tahleel", description: "Repelling then resolving — early inflammation", rule: { categories: [MSK, SKIN], symptoms: ["Joint pain", "Boils / pimples"], phase: 6 }, priority: 2 },
  { label: "Habs (checking flux)", description: "Checking excess discharge — diarrhoea, bleeding, heavy periods", rule: { symptoms: ["Loose stools", "Heavy periods", "Bleeding gums"], phase: 6 }, priority: 3 },
  { label: "Taskeen-e-Qalb-o-A'sab", description: "Calming the heart and nerves", rule: { symptoms: ["Anxiety / worry", "Palpitations", "Irritability / quick anger"], categories: [NEURO], phase: 6 }, priority: 3 },
  { label: "Tanzeem-e-Naum", description: "Regulating sleep and wakefulness", rule: { symptoms: ["Excessive drowsiness / oversleeping", "Anxiety / worry"], phase: 1 }, priority: 2 },
  { label: "Tanzeem-e-Harkat (Riyazat)", description: "Regulating exercise and rest", rule: { symptoms: ["Weight gain", "Heaviness of the body"], mizaj: ["Balghami", "Ratab", "Barid"], phase: 1 }, priority: 2 },
  { label: "Idrar-e-Haiz", description: "Regulating suppressed or scanty periods", rule: { symptoms: ["Irregular periods"], categories: [GYN], sex: "female", phase: 3, avoidIf: PREG }, priority: 2 },
  { label: "Taskeen-e-Hararat", description: "Lowering fever and excess heat", rule: { symptoms: ["Chills with fever (rigors)", "Feeling of heat / burning in the body"], mizaj: ["Safrawi", "Damawi", "Haar"], phase: 6 }, priority: 3 },
  { label: "Tajfeef-e-Rutubat (Balgham)", description: "Drying excess phlegm in the chest and head", rule: { symptoms: ["Cough with phlegm", "Runny nose"], categories: [RESP, ENT], phase: 6 }, priority: 3 },
];
