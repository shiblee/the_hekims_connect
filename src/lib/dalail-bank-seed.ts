// Dala'il question bank — selection metadata for the existing examination
// questions, plus a starter bank of further clinical-sign questions.
//
// Existing questions keep their review status (approved); they only gain
// links (complaint categories / symptoms / regions), a priority and a short
// purpose, so adaptive selection works straight away. Every NEW question here
// is written as a DRAFT: it is never shown to doctors until a qualified Unani
// physician reviews and approves it in Admin → Tashkhees & Ilaj → Dala'il.
// Humoral points follow the classical qualities (Safra hot-dry, Dam hot-moist,
// Balgham cold-moist, Sauda cold-dry) and are part of what the reviewer checks.

import type { AppliesTo } from "@/lib/dalail-engine";

const GEN = "General / Constitutional", DIG = "Digestive", RESP = "Respiratory", CARD = "Cardiac", URI = "Urinary",
  SKIN = "Skin", MSK = "Musculoskeletal", NEURO = "Neurological & Mental Health", ENT = "ENT & Eye", GYN = "Gynae & Reproductive";
const R = {
  gi: "Gastrointestinal / Hepato-Biliary", resp: "Respiratory / Sadr", heart: "Cardiovascular / Qalb", renal: "Renal / Urinary",
  skin: "Dermatological / Jild", eye: "Ophthalmic / Ayn", ent: "Ear, Nose & Throat", oral: "Oral & Dental / Fam", anal: "Anorectal / Maq'ad",
  gyn: "Gynaecological / Rahim", neck: "Musculoskeletal / Cervical", spine: "Spinal / Back", limbs: "Limbs & Peripheral Vessels",
  head: "Cranial / Neurological", mind: "Psychological / Nafsani", endo: "Endocrine & Metabolic", blood: "Blood & Lymphatic", gen: "General / Systemic",
};

export interface SelectionMeta { appliesTo: AppliesTo; priority: number; purpose: string; safetyCritical?: boolean }

/** section|question label → metadata for the questions already in the bank. */
export const EXISTING_DALAIL_META: Record<string, SelectionMeta> = {
  "nabz|Miqdar (Magnitude)": { appliesTo: { always: true }, priority: 4, purpose: "Core pulse sign — strength of the vital faculty and fullness" },
  "nabz|Quwwat (Strength)": { appliesTo: { always: true }, priority: 4, purpose: "Core pulse sign — reserve of the vital faculty (Quwwat-e-Haiwaniya)" },
  "nabz|Zaman-e-Harkat (Speed)": { appliesTo: { always: true, categories: [GEN, CARD] }, priority: 4, purpose: "Core pulse sign — heat or cold of the temperament" },
  "nabz|Harr-o-Bard (Temperature to touch)": { appliesTo: { always: true, categories: [GEN] }, priority: 4, purpose: "Core pulse sign — hot or cold dominance" },
  "nabz|Qiwam-e-Aala (Vessel consistency)": { appliesTo: { categories: [CARD, MSK], regions: [R.heart, R.limbs] }, priority: 2, purpose: "Dryness or moistness of the vessel wall" },
  "nabz|Imtila-o-Khala (Fullness)": { appliesTo: { categories: [CARD, GEN], symptoms: ["Heaviness of the body", "General weakness"] }, priority: 3, purpose: "Repletion (Imtila) versus depletion" },
  "nabz|Zaman-e-Sukoon (Rest interval)": { appliesTo: { categories: [CARD] }, priority: 2, purpose: "Interval between beats — heat or cold" },
  "nabz|Istiwa-o-Ikhtilaf (Regularity)": { appliesTo: { categories: [CARD], symptoms: ["Palpitations"], regions: [R.heart] }, priority: 4, purpose: "Irregular pulse with palpitations needs checking" },
  "nabz|Nizam (Order)": { appliesTo: { categories: [CARD], symptoms: ["Palpitations"] }, priority: 3, purpose: "Order of irregular beats" },
  "nabz|Wazan (Rhythm)": { appliesTo: { categories: [CARD], symptoms: ["Palpitations"] }, priority: 2, purpose: "Rhythm relative to age" },
  "baul|Laun (Colour)": { appliesTo: { categories: [URI, DIG, GEN], symptoms: ["Dark yellow / high-coloured urine", "Pale / whitish urine", "Burning on passing urine", "Yellowish eyes", "Yellowish skin"], regions: [R.renal, R.gi] }, priority: 4, purpose: "Urine colour — the clearest humoral sign of heat or cold" },
  "baul|Qiwam (Consistency)": { appliesTo: { categories: [URI], regions: [R.renal] }, priority: 3, purpose: "Thin or thick urine — digestion of humours (Nuzj)" },
  "baul|Rasub (Sediment)": { appliesTo: { categories: [URI], regions: [R.renal] }, priority: 3, purpose: "Sediment shows maturation (Nuzj) of morbid matter" },
  "baul|Raiha (Odour)": { appliesTo: { categories: [URI], symptoms: ["Burning on passing urine"] }, priority: 2, purpose: "Pungent or foul odour suggests heat or putrefaction" },
  "baul|Miqdar (Quantity)": { appliesTo: { categories: [URI], symptoms: ["Frequent urination", "Reduced urine", "Passing urine at night"] }, priority: 3, purpose: "Scanty or copious urine" },
  "baraz|Laun (Colour)": { appliesTo: { categories: [DIG], regions: [R.gi, R.anal] }, priority: 3, purpose: "Stool colour — bile flow and humoral dominance" },
  "baraz|Qiwam (Consistency)": { appliesTo: { categories: [DIG], symptoms: ["Constipation", "Loose stools", "Abdominal cramps"], regions: [R.gi, R.anal] }, priority: 5, purpose: "Stool consistency for bowel complaints" },
  "baraz|Raiha (Odour)": { appliesTo: { categories: [DIG], symptoms: ["Loose stools", "Indigestion"] }, priority: 2, purpose: "Foul or sour stool — putrefaction or cold digestion" },
  "lisan|Laun (Colour)": { appliesTo: { always: true }, priority: 3, purpose: "Tongue colour — a quick humoral sign for every patient" },
  "lisan|Coating (Ghisha)": { appliesTo: { categories: [DIG, RESP], symptoms: ["Bad breath", "Indigestion", "Loss of taste / tasteless mouth", "Nausea"], regions: [R.gi, R.oral] }, priority: 4, purpose: "Coating shows the state of the stomach (Meda)" },
  "lisan|Rutubat (Moisture)": { appliesTo: { categories: [GEN, DIG], symptoms: ["Dry mouth", "Feeling of heat / burning in the body"] }, priority: 3, purpose: "Dryness or moistness of the tongue" },
  "zahiri|Laun-e-Badan (Complexion)": { appliesTo: { categories: [SKIN, GEN], symptoms: ["Pale skin", "Yellowish skin", "General weakness"], regions: [R.skin, R.blood] }, priority: 3, purpose: "Complexion — humoral colour of the body" },
  "zahiri|Hay'at-e-Aza (Body build)": { appliesTo: { categories: [GEN, MSK] }, priority: 2, purpose: "Body build — constitutional temperament" },
  "zahiri|Malmas (Skin to the touch)": { appliesTo: { always: true }, priority: 3, purpose: "Feel of the skin — hot/cold and moist/dry" },
  "zahiri|Sha'r (Hair)": { appliesTo: { categories: [SKIN], symptoms: ["Hair fall"] }, priority: 2, purpose: "Hair growth and texture — constitution" },
  "zahiri|Other findings": { appliesTo: {}, priority: 1, purpose: "Free-text findings (added by the doctor when needed)" },
};

type Opt = [label: string, description: string | null, safra: number, dam: number, balgham: number, sauda: number];
export interface NewDalailQuestion extends SelectionMeta { section: string; label: string; labelLocal?: string; type?: "single_select" | "multi_select" | "text"; options: Opt[] }

export const NEW_DALAIL_SECTIONS = [
  { key: "naftha", label: "Naftha (Sputum)", english: "Sputum examination" },
  { key: "ayn", label: "Ayn (Eyes)", english: "Eye inspection" },
  { key: "batn", label: "Batn (Abdomen)", english: "Abdominal examination" },
  { key: "jild", label: "Jild (Skin findings)", english: "Skin examination" },
  { key: "mafasil", label: "Mafasil (Joints)", english: "Joint examination" },
  { key: "asab", label: "Dimagh-o-A'sab", english: "Head & nervous examination" },
];

export const NEW_DALAIL_QUESTIONS: NewDalailQuestion[] = [
  // ---- Nabz (pulse) — complaint-specific
  { section: "nabz", label: "Pulse in fever (Nabz-e-Humma)", type: "single_select", priority: 4, purpose: "Pulse pattern during fever", appliesTo: { symptoms: ["Chills with fever (rigors)", "Feeling of heat / burning in the body"], categories: [GEN] },
    options: [["Fast and full (Saree'-Mumtali)", null, 1, 1.5, 0, 0], ["Fast and hard (Saree'-Sulb)", null, 1.5, 0, 0, 0.5], ["Slow and soft (Bati'-Layyin)", null, 0, 0, 1.5, 0], ["Not febrile now", null, 0, 0, 0, 0]] },
  { section: "nabz", label: "Very weak or thready pulse (Nabz-e-Namli)", type: "single_select", priority: 5, safetyCritical: true, purpose: "Thready, ant-like pulse is a warning sign of collapse", appliesTo: { always: true },
    options: [["Yes — very weak, thready", "Check vitals and consider urgent referral", 0, 0, 1, 1], ["No", null, 0, 0, 0, 0]] },
  { section: "nabz", label: "Pulse with breathlessness (Nabz in Zeeq-un-Nafas)", type: "single_select", priority: 3, purpose: "Pulse quality in breathing complaints", appliesTo: { categories: [RESP], symptoms: ["Breathlessness on exertion", "Wheezing"], regions: [R.resp] },
    options: [["Fast and weak", null, 0.5, 0, 1, 0.5], ["Fast and full", null, 1, 1, 0, 0], ["Normal", null, 0, 0, 0, 0]] },

  // ---- Baul (urine)
  { section: "baul", label: "Blood in urine (Baul-ud-Dam)", type: "single_select", priority: 5, safetyCritical: true, purpose: "Visible blood in urine needs prompt evaluation", appliesTo: { categories: [URI], regions: [R.renal] },
    options: [["Yes, visible blood", "Consider referral", 0, 1, 0, 0], ["No", null, 0, 0, 0, 0]] },
  { section: "baul", label: "Froth on urine (Zabad)", type: "single_select", priority: 2, purpose: "Persistent froth — heat or albumin", appliesTo: { categories: [URI], regions: [R.renal, R.endo] },
    options: [["Persistent froth", null, 1, 0.5, 0, 0], ["Little or none", null, 0, 0, 0, 0]] },
  { section: "baul", label: "Burning while passing urine (Hurqat-ul-Baul) — on examination", type: "single_select", priority: 3, purpose: "Confirms heat (Hararat) of the urinary tract", appliesTo: { symptoms: ["Burning on passing urine"], categories: [URI] },
    options: [["Marked burning", null, 2, 0, 0, 0], ["Mild", null, 1, 0, 0, 0], ["None", null, 0, 0, 0, 0]] },
  { section: "baul", label: "Urine in fever — colour change", type: "single_select", priority: 3, purpose: "Urine colour during fever shows the humour involved", appliesTo: { symptoms: ["Chills with fever (rigors)"] },
    options: [["Deep yellow / fiery", null, 2, 0, 0, 0], ["Reddish", null, 0, 2, 0, 0], ["Pale", null, 0, 0, 1.5, 0], ["Dark", null, 0, 0, 0, 1.5]] },

  // ---- Baraz (stool)
  { section: "baraz", label: "Blood or mucus in stool", type: "multi_select", priority: 5, safetyCritical: true, purpose: "Blood in stool needs evaluation; mucus shows Balgham", appliesTo: { categories: [DIG], symptoms: ["Loose stools", "Abdominal cramps"], regions: [R.gi, R.anal] },
    options: [["Fresh blood", "Consider referral if heavy or persistent", 0, 1, 0, 0], ["Dark / black (tarry)", "Urgent — possible upper GI bleed", 0, 0, 0, 1], ["Mucus", null, 0, 0, 1.5, 0], ["Neither", null, 0, 0, 0, 0]] },
  { section: "baraz", label: "Undigested food in stool (Zalaq-ul-Am'a)", type: "single_select", priority: 3, purpose: "Weak digestion (Zof-e-Hazm)", appliesTo: { symptoms: ["Undigested food in stool", "Indigestion", "Loose stools"], categories: [DIG] },
    options: [["Yes", null, 0, 0, 1.5, 0], ["No", null, 0, 0, 0, 0]] },
  { section: "baraz", label: "Bowel frequency per day", type: "single_select", priority: 3, purpose: "Frequency helps grade constipation or diarrhoea", appliesTo: { symptoms: ["Constipation", "Loose stools"], categories: [DIG] },
    options: [["Less than once in 2 days", null, 0, 0, 0, 1.5], ["Once a day", null, 0, 0, 0, 0], ["2–3 times", null, 0.5, 0, 0.5, 0], ["More than 3 times", null, 1.5, 0, 0.5, 0]] },
  { section: "baraz", label: "Piles on inspection (Bawaseer)", type: "single_select", priority: 3, purpose: "Bleeding or non-bleeding piles — Sauda or Dam", appliesTo: { regions: [R.anal], symptoms: ["Constipation"] },
    options: [["Bleeding piles (Bawaseer-e-Damiya)", null, 0, 1.5, 0, 0.5], ["Non-bleeding piles (Bawaseer-e-Amya)", null, 0, 0, 0, 1.5], ["None seen", null, 0, 0, 0, 0]] },

  // ---- Lisan (tongue)
  { section: "lisan", label: "Cracks or fissures on the tongue", type: "single_select", priority: 2, purpose: "Fissured tongue — dryness (Yubusat)", appliesTo: { symptoms: ["Dry mouth"], categories: [DIG] },
    options: [["Deep cracks", null, 0.5, 0, 0, 1.5], ["Few fine cracks", null, 0, 0, 0, 0.5], ["None", null, 0, 0, 0, 0]] },
  { section: "lisan", label: "Tongue edges — teeth marks", type: "single_select", priority: 2, purpose: "Scalloped edges suggest excess moisture (Rutubat)", appliesTo: { categories: [DIG, GEN], symptoms: ["Heaviness of the body", "Bloating / gas"] },
    options: [["Marked teeth marks", null, 0, 0, 1.5, 0], ["None", null, 0, 0, 0, 0]] },
  { section: "lisan", label: "Mouth ulcers on inspection (Qula')", type: "single_select", priority: 3, purpose: "Ulcers usually reflect heat (Hararat) or Safra", appliesTo: { symptoms: ["Mouth ulcers"], regions: [R.oral] },
    options: [["Multiple, painful, red-edged", null, 1.5, 0.5, 0, 0], ["Single, pale", null, 0, 0, 1, 0], ["None", null, 0, 0, 0, 0]] },

  // ---- Zahiri (inspection)
  { section: "zahiri", label: "Swelling of feet or ankles (Waram)", type: "single_select", priority: 4, purpose: "Pitting oedema — Balgham, heart or kidney involvement", appliesTo: { symptoms: ["Swelling of the feet", "Breathlessness on exertion"], categories: [CARD, URI], regions: [R.limbs, R.renal, R.heart] },
    options: [["Pitting swelling", "Check heart and kidney function", 0, 0, 1.5, 0], ["Firm, non-pitting", null, 0, 0, 0, 1], ["None", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Pallor of nails and inner eyelids", type: "single_select", priority: 4, purpose: "Pallor suggests depletion of blood (Qillat-ud-Dam)", appliesTo: { symptoms: ["General weakness", "Tiredness / fatigue", "Pale skin", "Heavy periods"], regions: [R.blood] },
    options: [["Marked pallor", null, 0, 0, 1, 0.5], ["Mild", null, 0, 0, 0.5, 0], ["Normal pink", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Yellow tinge of eyes or skin (Yarqan)", type: "single_select", priority: 5, safetyCritical: true, purpose: "Jaundice needs liver evaluation", appliesTo: { symptoms: ["Yellowish eyes", "Yellowish skin", "Dark yellow / high-coloured urine"], regions: [R.gi] },
    options: [["Yellow (Yarqan-e-Asfar)", "Check liver function", 2, 0, 0, 0], ["Dark / dusky (Yarqan-e-Aswad)", "Check liver and spleen", 0, 0, 0, 2], ["None", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Recent weight change on inspection", type: "single_select", priority: 3, purpose: "Wasting (Huzal) or gain (Siman)", appliesTo: { symptoms: ["Unintended weight loss", "Weight gain"], regions: [R.endo] },
    options: [["Visible wasting", "Unexplained loss needs evaluation", 0.5, 0, 0, 1.5], ["Weight gain / puffiness", null, 0, 0.5, 1.5, 0], ["No change", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Enlarged glands (neck, armpit, groin)", type: "single_select", priority: 4, purpose: "Lymph glands — Balghami swelling or infection", appliesTo: { regions: [R.blood, R.ent], symptoms: ["Sore throat", "Chills with fever (rigors)"] },
    options: [["Tender, enlarged", null, 0.5, 1, 0.5, 0], ["Hard, painless", "Needs evaluation", 0, 0, 0, 1.5], ["None", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Facial flushing", type: "single_select", priority: 2, purpose: "Flushed face — Dam or Safra heat", appliesTo: { symptoms: ["Feeling of heat / burning in the body", "Hot flushes", "Headache"] },
    options: [["Red, flushed", null, 0.5, 1.5, 0, 0], ["Normal", null, 0, 0, 0, 0]] },
  { section: "zahiri", label: "Nails — shape and colour", type: "single_select", priority: 2, purpose: "Nail changes — dryness, pallor or clubbing", appliesTo: { categories: [RESP, CARD], regions: [R.blood] },
    options: [["Clubbed", "Needs chest or heart evaluation", 0, 0, 0.5, 0.5], ["Brittle, ridged", null, 0, 0, 0, 1.5], ["Pale", null, 0, 0, 1, 0], ["Normal", null, 0, 0, 0, 0]] },

  // ---- Naftha (sputum)
  { section: "naftha", label: "Sputum colour (Laun-e-Naftha)", type: "single_select", priority: 4, purpose: "Sputum colour shows the humour involved", appliesTo: { symptoms: ["Cough with phlegm"], categories: [RESP], regions: [R.resp] },
    options: [["White, clear", null, 0, 0, 2, 0], ["Yellow", null, 2, 0, 0, 0], ["Green", null, 1.5, 0.5, 0, 0], ["Grey / dark", null, 0, 0, 0, 1.5]] },
  { section: "naftha", label: "Sputum consistency", type: "single_select", priority: 3, purpose: "Thick or thin sputum — maturity (Nuzj) of phlegm", appliesTo: { symptoms: ["Cough with phlegm"], categories: [RESP] },
    options: [["Thick, sticky (Ghaleez)", null, 0, 0, 1.5, 0.5], ["Thin, watery (Raqeeq)", null, 0.5, 0, 1, 0], ["Frothy", null, 0.5, 0.5, 0.5, 0]] },
  { section: "naftha", label: "Blood in sputum (Nafs-ud-Dam)", type: "single_select", priority: 5, safetyCritical: true, purpose: "Blood in sputum needs prompt evaluation", appliesTo: { categories: [RESP], symptoms: ["Cough with phlegm", "Dry cough"], regions: [R.resp] },
    options: [["Streaks of blood", "Consider referral", 0, 1, 0, 0], ["Frank blood", "Urgent referral", 0, 1.5, 0, 0], ["None", null, 0, 0, 0, 0]] },
  { section: "naftha", label: "Chest sounds on listening", type: "multi_select", priority: 4, purpose: "Wheeze, crackles or reduced air entry", appliesTo: { categories: [RESP], symptoms: ["Wheezing", "Breathlessness on exertion", "Heaviness in the chest"], regions: [R.resp] },
    options: [["Wheeze (Safeer)", null, 0, 0, 1, 0.5], ["Crackles", null, 0, 0, 1.5, 0], ["Reduced air entry", "Needs evaluation", 0, 0, 1, 0], ["Clear", null, 0, 0, 0, 0]] },
  { section: "naftha", label: "Breathing rate and effort at rest", type: "single_select", priority: 5, safetyCritical: true, purpose: "Laboured breathing at rest is a warning sign", appliesTo: { categories: [RESP, CARD], symptoms: ["Breathlessness on exertion", "Wheezing"] },
    options: [["Laboured, using neck muscles", "Urgent — check oxygen", 0, 0, 1, 0], ["Slightly fast", null, 0.5, 0, 0.5, 0], ["Normal, easy", null, 0, 0, 0, 0]] },

  // ---- Ayn (eyes)
  { section: "ayn", label: "Colour of the whites of the eyes", type: "single_select", priority: 4, purpose: "Redness, yellowness or pallor of the sclera", appliesTo: { categories: [ENT], symptoms: ["Redness of the eyes", "Yellowish eyes"], regions: [R.eye] },
    options: [["Red, congested (Ramad)", null, 0.5, 1.5, 0, 0], ["Yellow", null, 2, 0, 0, 0], ["Pale bluish", null, 0, 0, 1, 0.5], ["Clear", null, 0, 0, 0, 0]] },
  { section: "ayn", label: "Watering or discharge from the eyes", type: "single_select", priority: 3, purpose: "Watery (Balgham) or sticky (Safra/Dam) discharge", appliesTo: { symptoms: ["Watery eyes", "Redness of the eyes"], regions: [R.eye] },
    options: [["Watery", null, 0, 0, 1.5, 0], ["Sticky, yellow", null, 1.5, 0.5, 0, 0], ["None", null, 0, 0, 0, 0]] },
  { section: "ayn", label: "Puffiness around the eyes", type: "single_select", priority: 3, purpose: "Morning puffiness — Balgham or kidney involvement", appliesTo: { categories: [URI, GEN], regions: [R.renal, R.eye] },
    options: [["Marked puffiness", null, 0, 0, 1.5, 0], ["None", null, 0, 0, 0, 0]] },

  // ---- Batn (abdomen)
  { section: "batn", label: "Abdominal tenderness on palpation", type: "single_select", priority: 4, purpose: "Where the abdomen is tender", appliesTo: { categories: [DIG], symptoms: ["Abdominal cramps", "Indigestion", "Nausea"], regions: [R.gi] },
    options: [["Upper middle (Meda)", null, 1, 0, 0.5, 0], ["Right upper (Kabid)", null, 1.5, 0, 0, 0], ["Left upper (Tihal)", null, 0, 0, 0, 1.5], ["Lower abdomen", null, 0, 0, 1, 0], ["Not tender", null, 0, 0, 0, 0]] },
  { section: "batn", label: "Rigid, board-like abdomen or guarding", type: "single_select", priority: 5, safetyCritical: true, purpose: "A rigid abdomen is a surgical emergency sign", appliesTo: { categories: [DIG], symptoms: ["Abdominal cramps", "Vomiting"], regions: [R.gi] },
    options: [["Yes — rigid / guarding", "Urgent referral", 0, 0, 0, 0], ["No", null, 0, 0, 0, 0]] },
  { section: "batn", label: "Abdominal distension and tympany", type: "single_select", priority: 3, purpose: "Gas (Riyah) versus fluid or fullness", appliesTo: { symptoms: ["Bloating / gas", "Constipation", "Belching"], categories: [DIG] },
    options: [["Distended, drum-like (Riyah)", null, 0, 0, 0.5, 1.5], ["Distended, dull", "Needs evaluation", 0, 0, 1.5, 0], ["Soft, not distended", null, 0, 0, 0, 0]] },
  { section: "batn", label: "Liver or spleen felt below the ribs", type: "single_select", priority: 3, purpose: "Enlarged liver (Kabid) or spleen (Tihal)", appliesTo: { regions: [R.gi, R.blood], symptoms: ["Yellowish eyes", "Yellowish skin"] },
    options: [["Liver enlarged", null, 1, 0.5, 0, 0], ["Spleen enlarged", null, 0, 0, 0, 1.5], ["Not felt", null, 0, 0, 0, 0]] },
  { section: "batn", label: "Warmth of the abdomen to touch", type: "single_select", priority: 2, purpose: "Heat or cold of the stomach (Meda)", appliesTo: { categories: [DIG], symptoms: ["Indigestion", "Feeling of heat / burning in the body"] },
    options: [["Warm", null, 1.5, 0.5, 0, 0], ["Cool", null, 0, 0, 1.5, 0.5], ["Normal", null, 0, 0, 0, 0]] },

  // ---- Jild (skin)
  { section: "jild", label: "Type of skin lesion", type: "multi_select", priority: 4, purpose: "Lesion type points to the humour involved", appliesTo: { categories: [SKIN], symptoms: ["Itching", "Skin rash / hives", "Boils / pimples"], regions: [R.skin] },
    options: [["Red, raised, hot (Dam)", null, 0, 1.5, 0, 0], ["Burning, yellowish pustules (Safra)", null, 1.5, 0, 0, 0], ["Moist, oozing (Balgham)", null, 0, 0, 1.5, 0], ["Dry, scaly, dark (Sauda)", null, 0, 0, 0, 1.5]] },
  { section: "jild", label: "Distribution of skin lesions", type: "single_select", priority: 2, purpose: "Localised or widespread", appliesTo: { categories: [SKIN], regions: [R.skin] },
    options: [["Localised", null, 0, 0, 0, 0], ["Widespread", null, 0.5, 0.5, 0, 0], ["In skin folds", null, 0, 0, 1, 0]] },
  { section: "jild", label: "Scratch marks or thickened skin", type: "single_select", priority: 2, purpose: "Chronic itching — thickening suggests Sauda", appliesTo: { symptoms: ["Itching", "Dry skin"], categories: [SKIN] },
    options: [["Thickened, leathery", null, 0, 0, 0, 1.5], ["Fresh scratch marks", null, 0.5, 0.5, 0, 0], ["None", null, 0, 0, 0, 0]] },
  { section: "jild", label: "Rapidly spreading redness or skin turning dark", type: "single_select", priority: 5, safetyCritical: true, purpose: "Spreading infection is a warning sign", appliesTo: { categories: [SKIN], symptoms: ["Boils / pimples", "Skin rash / hives"], regions: [R.skin] },
    options: [["Yes", "Urgent referral", 0, 1, 0, 0], ["No", null, 0, 0, 0, 0]] },

  // ---- Mafasil (joints)
  { section: "mafasil", label: "Joint swelling and warmth", type: "single_select", priority: 4, purpose: "Hot swelling (Dam/Safra) or cold swelling (Balgham)", appliesTo: { categories: [MSK], symptoms: ["Joint pain", "Joint stiffness"], regions: [R.limbs, R.neck, R.spine] },
    options: [["Hot, red, swollen", null, 1, 1.5, 0, 0], ["Swollen, cool, soft", null, 0, 0, 1.5, 0], ["Not swollen, stiff", null, 0, 0, 0, 1.5], ["Normal", null, 0, 0, 0, 0]] },
  { section: "mafasil", label: "Which joints are affected", type: "multi_select", priority: 3, purpose: "Pattern of joint involvement", appliesTo: { categories: [MSK], symptoms: ["Joint pain"], regions: [R.limbs, R.neck, R.spine] },
    options: [["Small joints of hands / feet", null, 0, 0.5, 0.5, 0], ["Knees", null, 0, 0, 1, 0], ["Big toe (Niqris)", null, 0.5, 1, 0, 0], ["Spine / back", null, 0, 0, 0.5, 1], ["Hips / shoulders", null, 0, 0, 0.5, 0.5]] },
  { section: "mafasil", label: "Range of movement", type: "single_select", priority: 3, purpose: "Restriction of movement", appliesTo: { categories: [MSK], symptoms: ["Joint stiffness", "Back pain"], regions: [R.limbs, R.neck, R.spine] },
    options: [["Markedly restricted", null, 0, 0, 0.5, 1], ["Mildly restricted", null, 0, 0, 0.5, 0.5], ["Full", null, 0, 0, 0, 0]] },
  { section: "mafasil", label: "Back pain with leg weakness or numbness", type: "single_select", priority: 5, safetyCritical: true, purpose: "Nerve compression is a warning sign", appliesTo: { symptoms: ["Back pain", "Tingling or numbness"], regions: [R.spine] },
    options: [["Yes", "Urgent referral if bladder/bowel affected", 0, 0, 0, 0], ["No", null, 0, 0, 0, 0]] },

  // ---- Dimagh-o-A'sab (head & nerves)
  { section: "asab", label: "Neck stiffness with headache and fever", type: "single_select", priority: 5, safetyCritical: true, purpose: "Possible meningitis (Sirsam) — urgent", appliesTo: { symptoms: ["Headache"], categories: [NEURO], regions: [R.head] },
    options: [["Yes — neck stiff", "Urgent referral", 1, 1, 0, 0], ["No", null, 0, 0, 0, 0]] },
  { section: "asab", label: "Site of headache (Suda')", type: "single_select", priority: 3, purpose: "Site helps identify the humour involved", appliesTo: { symptoms: ["Headache", "Heaviness of the head"], categories: [NEURO], regions: [R.head] },
    options: [["Forehead", null, 0, 0, 1, 0], ["Temples / one side (Shaqeeqa)", null, 1.5, 0, 0, 0], ["Back of head / neck", null, 0, 0, 0, 1], ["Whole head, heavy", null, 0, 1, 1, 0]] },
  { section: "asab", label: "Tremor on outstretched hands", type: "single_select", priority: 2, purpose: "Tremor (Ra'sha) — weakness of nerves", appliesTo: { symptoms: ["Tremor"], categories: [NEURO] },
    options: [["Fine tremor", null, 0.5, 0, 0, 1], ["Coarse tremor", null, 0, 0, 1, 0.5], ["None", null, 0, 0, 0, 0]] },
  { section: "asab", label: "Sensation in hands and feet", type: "single_select", priority: 3, purpose: "Numbness (Khadar) — cold or dry involvement of nerves", appliesTo: { symptoms: ["Tingling or numbness"], categories: [NEURO], regions: [R.limbs] },
    options: [["Reduced, glove-and-stocking", "Check blood sugar", 0, 0, 1, 1], ["Patchy", null, 0, 0, 0.5, 0.5], ["Normal", null, 0, 0, 0, 0]] },
  { section: "asab", label: "Mood and manner during consultation", type: "single_select", priority: 2, purpose: "Observed temperament (A'raz-e-Nafsaniya)", appliesTo: { categories: [NEURO], symptoms: ["Anxiety / worry", "Low mood / sadness", "Irritability / quick anger"], regions: [R.mind] },
    options: [["Restless, irritable", null, 1.5, 0, 0, 0], ["Cheerful, talkative", null, 0, 1.5, 0, 0], ["Slow, dull, sleepy", null, 0, 0, 1.5, 0], ["Withdrawn, anxious", null, 0, 0, 0, 1.5]] },
  { section: "zahiri", label: "Gynaecological inspection finding", type: "text", priority: 2, purpose: "Free-text finding for women's health complaints (with consent)", appliesTo: { categories: [GYN], regions: [R.gyn], sex: "female" }, options: [] },
];
