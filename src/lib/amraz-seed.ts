// Starting Amraz catalogue for the Stage 5 differential engine. Drafted from
// classical Unani nosology; every entry arrives UNVERIFIED (reviewStatus
// "draft") and is labelled so on screen until a physician approves it in
// Admin → Meta → Tashkhees & Ilaj → Amraz. Wording, typical temperaments and
// signs are for review, not established fact.
//
// Matching (see differential-engine.ts) — a sign matches when ANY of its
// criteria match what is recorded for the visit:
//   complaints: ChiefComplaint keys · categories · symptoms / regions: label substrings
//   exam / life: { s: section key, q?: question substring, o: answer substring } (Dala'il / Asbab)
//   worse / better: substrings of the complaint's aggravating / relieving factors
//   text: substrings anywhere in complaints, symptoms, notes and the intake narrative
//   vitals: vital flag keys (fever, fever_high, spo2_low, bp_high, pulse_fast …)
//   conditions: history condition keys (diabetes, hypertension …)
//   sex / minAge / maxAge

export interface MarzMatch {
  complaints?: string[]; categories?: string[]; symptoms?: string[]; regions?: string[];
  exam?: { s: string; q?: string; o: string }[]; life?: { s: string; q?: string; o: string }[];
  worse?: string[]; better?: string[]; text?: string[]; vitals?: string[]; conditions?: string[];
  sex?: "male" | "female"; minAge?: number; maxAge?: number;
}
export interface MarzSign { text: string; weight?: number; match: MarzMatch }
export interface MarzSeed {
  key: string; label: string; localName?: string; category: string; description?: string; icd?: string;
  organs: string[]; mizaj: string[]; type?: "Sada" | "Maddi"; sabab: string[];
  appliesTo: { complaints?: string[]; categories?: string[]; symptoms?: string[]; regions?: string[] };
  signs: MarzSign[]; against?: MarzSign[]; dontMiss?: { label: string; why: string }[]; investigations?: string[];
}

export const MARZ_SOURCES = [
  { title: "Ibn Sina, Al-Qanun fi'l-Tibb, Book III (diseases by organ)" },
  { title: "Standard Unani Medical Terminology (CCRUM / WHO, 2012)" },
  { title: "Ali ibn Abbas al-Majusi, Kamil-us-Sana'a" },
];

const ex = (s: string, o: string, q?: string) => ({ s, o, q });
const S = (text: string, match: MarzMatch, weight = 2): MarzSign => ({ text, match, weight });

// Shared serious alternatives
const MI = { label: "Heart attack (acute coronary syndrome)", why: "Upper abdominal or chest pain, especially with sweating, breathlessness or pain spreading to the arm or jaw, in an adult over 35." };
const GI_BLEED = { label: "Bleeding from the stomach or bowel", why: "Black tarry stools, vomiting blood or fresh blood with dizziness or a fast pulse." };
const ACUTE_ABDOMEN = { label: "Acute abdomen (appendicitis, perforation, obstruction)", why: "Rigid or guarded abdomen, severe constant pain, repeated vomiting or no passage of stool or wind." };
const DEHYDRATION = { label: "Dehydration", why: "Low blood pressure, fast pulse, scanty dark urine or dry tongue with diarrhoea or vomiting." };
const STROKE = { label: "Stroke", why: "Sudden weakness of face, arm or leg, slurred speech or confusion — needs emergency care." };
const MENINGITIS = { label: "Meningitis", why: "Headache with fever and a stiff neck, rash or drowsiness." };
const SEVERE_ASTHMA = { label: "Severe breathing difficulty", why: "Oxygen below 92%, laboured breathing or unable to speak in sentences." };
const CAUDA = { label: "Spinal cord or nerve-root compression", why: "Back pain with leg weakness, numbness around the saddle area, or loss of bladder or bowel control." };
const PREGNANCY = { label: "Pregnancy", why: "Missed period or nausea in a woman of child-bearing age — check before any medicine or regimen." };
const CANCER_BOWEL = { label: "Bowel cancer", why: "Over 45 with a change in bowel habit, blood in stool, weight loss or anaemia." };
const SEPSIS_KIDNEY = { label: "Kidney infection", why: "Fever with loin pain or vomiting alongside urinary symptoms." };

export const AMRAZ: MarzSeed[] = [
  // ---------------------------------------------------------------- Digestive
  {
    key: "su_e_hazm", label: "Su-e-Hazm (Dyspepsia)", localName: "سوء ہضم", category: "Amraz-e-Hazm (digestive)", icd: "K30",
    description: "Weak or disordered digestion in the stomach: heaviness, fullness and belching after food.",
    organs: ["Meda"], mizaj: ["Balghami", "Barid"], type: "Sada", sabab: ["Heavy or excessive food", "Eating before the last meal is digested", "Cold, moist foods", "Weak stomach (Zo'f-e-Meda)"],
    appliesTo: { complaints: ["indigestion", "belching_burping_jusha", "flatulence_gas_nafkh_e_shikam", "stomach_weakness_zo_f_e_mi_da", "loss_of_appetite_zo_f_e_ishtaha", "loss_of_appetite_zu_f_e_ishtiha", "nausea_ghasyan", "abdominal_pain"] },
    signs: [
      S("Heaviness or fullness after meals", { text: ["heaviness", "fullness", "after meal", "after food", "bloat"], complaints: ["indigestion"] }, 3),
      S("Belching or flatulence", { complaints: ["belching_burping_jusha", "flatulence_gas_nafkh_e_shikam"], text: ["belch", "gas"] }),
      S("Thick white coating on the tongue", { exam: [ex("lisan", "Thick white coat")] }, 3),
      S("Distended, drum-like abdomen", { exam: [ex("batn", "drum-like")] }),
      S("Undigested food in stool", { exam: [ex("baraz", "Yes", "Undigested")] }),
    ],
    against: [S("Fever", { vitals: ["fever", "fever_high"] }), S("Vomiting blood or black stools", { complaints: ["vomiting_blood_hematemesis_qai_ud_dam", "blood_in_stool_zahir_ud_dam"], exam: [ex("baraz", "tarry")] }, 4)],
    dontMiss: [MI, GI_BLEED], investigations: ["Stool examination if diarrhoea", "Ultrasound abdomen if persistent"],
  },
  {
    key: "humuzat_e_meda", label: "Humuzat-e-Meda / Hurqat-e-Meda (Hyperacidity, heartburn)", localName: "حموضتِ معدہ", category: "Amraz-e-Hazm (digestive)", icd: "K21",
    description: "Excess sharp, burning (Safrawi) matter in the stomach: burning, sour belching, worse with hot and spicy food.",
    organs: ["Meda"], mizaj: ["Safrawi", "Haar"], type: "Maddi", sabab: ["Hot, spicy or fried food", "Long gaps between meals", "Anger and worry", "Tea, coffee or smoking"],
    appliesTo: { complaints: ["acidity_heartburn", "burning_in_chest_retrosternal_burning_hurqat_us_sadr", "burning_in_chest_and_stomach_sozish_e_mi_da", "chest_pain", "bitter_taste_in_mouth_mararat_ul_fam", "belching_burping_jusha"] },
    signs: [
      S("Burning in the stomach or chest", { complaints: ["acidity_heartburn", "burning_in_chest_retrosternal_burning_hurqat_us_sadr", "burning_in_chest_and_stomach_sozish_e_mi_da"], text: ["burning"] }, 3),
      S("Worse with spicy, hot food or an empty stomach", { worse: ["spic", "hot food", "empty stomach", "fasting", "tea", "coffee", "fried"] }),
      S("Better with cold drinks, milk or food", { better: ["cold", "milk", "food", "eating"] }),
      S("Yellow fur on the tongue or bitter taste", { exam: [ex("lisan", "Yellow fur")], complaints: ["bitter_taste_in_mouth_mararat_ul_fam"], symptoms: ["Bitter taste"] }),
      S("Tenderness in the upper middle abdomen", { exam: [ex("batn", "Upper middle")] }),
    ],
    against: [S("Heaviness and thick white tongue coat (cold dyspepsia)", { exam: [ex("lisan", "Thick white coat")] })],
    dontMiss: [MI, GI_BLEED], investigations: ["H. pylori test if recurrent", "Endoscopy if over 45, weight loss, difficulty swallowing or bleeding"],
  },
  {
    key: "waram_e_meda", label: "Waram-e-Meda (Gastritis)", localName: "ورمِ معدہ", category: "Amraz-e-Hazm (digestive)", icd: "K29",
    description: "Inflammation of the stomach: burning or gnawing epigastric pain, nausea, sometimes vomiting.",
    organs: ["Meda"], mizaj: ["Haar", "Safrawi", "Damawi"], type: "Maddi", sabab: ["Hot, sharp food or drink", "Painkillers (NSAIDs)", "Infection", "Alcohol"],
    appliesTo: { complaints: ["gastritis_stomach_inflammation_waram_e_mi_da", "abdominal_pain", "nausea_ghasyan", "vomiting", "acidity_heartburn", "burning_in_chest_and_stomach_sozish_e_mi_da"] },
    signs: [
      S("Upper middle abdominal pain or tenderness", { complaints: ["gastritis_stomach_inflammation_waram_e_mi_da"], exam: [ex("batn", "Upper middle")], regions: ["Epigastr", "Upper abdomen", "Stomach"] }, 3),
      S("Nausea or vomiting", { complaints: ["nausea_ghasyan", "vomiting"], text: ["nausea", "vomit"] }),
      S("Warm abdomen to touch", { exam: [ex("batn", "Warm", "Warmth")] }),
      S("Taking painkillers", { text: ["diclofenac", "ibuprofen", "aspirin", "ecosprin", "painkiller", "nsaid"] }),
    ],
    dontMiss: [MI, GI_BLEED, ACUTE_ABDOMEN], investigations: ["H. pylori test", "Endoscopy if red flags"],
  },
  {
    key: "qurha_e_meda", label: "Qurha-e-Meda (Peptic ulcer)", localName: "قرحۂ معدہ", category: "Amraz-e-Hazm (digestive)", icd: "K27",
    description: "Ulcer of the stomach or duodenum: gnawing pain related to meals, night pain, risk of bleeding.",
    organs: ["Meda", "Ama"], mizaj: ["Safrawi", "Haar"], type: "Maddi", sabab: ["Sharp (Hadd) Safrawi matter", "Painkillers", "H. pylori infection", "Smoking and stress"],
    appliesTo: { complaints: ["peptic_ulcer_stomach_ulcer_qurha_e_mi_da", "abdominal_pain", "acidity_heartburn", "vomiting_blood_hematemesis_qai_ud_dam"] },
    signs: [
      S("Gnawing pain, better or worse with meals, waking at night", { complaints: ["peptic_ulcer_stomach_ulcer_qurha_e_mi_da"], text: ["night", "gnawing", "hunger pain"] }, 3),
      S("Upper middle abdominal tenderness", { exam: [ex("batn", "Upper middle")] }),
      S("Taking painkillers", { text: ["diclofenac", "ibuprofen", "aspirin", "ecosprin", "painkiller", "nsaid"] }),
      S("Black or bloody stool / vomiting blood", { exam: [ex("baraz", "tarry")], complaints: ["vomiting_blood_hematemesis_qai_ud_dam"] }, 2),
    ],
    dontMiss: [GI_BLEED, { label: "Perforated ulcer", why: "Sudden severe pain with a rigid, board-like abdomen." }, MI], investigations: ["Endoscopy", "H. pylori test", "Haemoglobin if bleeding suspected"],
  },
  {
    key: "qabz", label: "Qabz (Constipation)", localName: "قبض", category: "Amraz-e-Hazm (digestive)", icd: "K59.0",
    description: "Infrequent, hard or difficult stools.",
    organs: ["Ama"], mizaj: ["Yabis", "Saudawi"], type: "Sada", sabab: ["Dry, low-fibre food", "Too little water", "Inactivity", "Holding back stool (Ihtibas)", "Dryness of the intestines"],
    appliesTo: { complaints: ["constipation", "painful_defecation_usr_ul_taghwwut", "piles", "anal_fissure_shiqaq_ul_miq_ad", "flatulence_gas_nafkh_e_shikam"] },
    signs: [
      S("Hard, dry pellets", { exam: [ex("baraz", "Hard / dry pellets")], text: ["hard stool"] }, 3),
      S("Stool less than once in 2 days", { exam: [ex("baraz", "Less than once in 2 days")], complaints: ["constipation"] }, 3),
      S("Dry tongue or skin", { exam: [ex("lisan", "Dry, parched"), ex("zahiri", "Cool and dry"), ex("zahiri", "Hot and dry")] }),
    ],
    against: [S("Loose stools", { exam: [ex("baraz", "Loose / liquid")] }, 4)],
    dontMiss: [CANCER_BOWEL, { label: "Bowel obstruction", why: "Constipation with a distended abdomen, vomiting and no passage of wind." }], investigations: ["Thyroid test if persistent", "Colonoscopy if over 45 with blood or weight loss"],
  },
  {
    key: "ishal", label: "Ishal (Diarrhoea)", localName: "اسہال", category: "Amraz-e-Hazm (digestive)", icd: "A09",
    description: "Frequent loose or watery stools.",
    organs: ["Ama"], mizaj: ["Ratab", "Balghami", "Safrawi"], type: "Maddi", sabab: ["Contaminated food or water", "Moist, heavy foods", "Weak digestion", "Safrawi matter in the bowel"],
    appliesTo: { complaints: ["loose_motion", "cholera_acute_diarrhea_and_vomiting_haiza", "lienteric_diarrhea_undigested_stools_zalaq_ul_ama_a", "abdominal_cramps_griping_maghas"] },
    signs: [
      S("Loose or liquid stools", { exam: [ex("baraz", "Loose / liquid")], complaints: ["loose_motion"] }, 3),
      S("More than 3 stools a day", { exam: [ex("baraz", "More than 3 times")] }, 2),
      S("Yellowish stool with burning (Safrawi)", { exam: [ex("baraz", "Yellowish")] }),
      S("Abdominal cramps", { complaints: ["abdominal_cramps_griping_maghas"] }),
    ],
    against: [S("Hard stools", { exam: [ex("baraz", "Hard / dry pellets")] }, 4)],
    dontMiss: [DEHYDRATION, { label: "Cholera or severe infection", why: "Profuse watery stools, vomiting, fever or blood in stool." }], investigations: ["Stool examination and culture if blood, fever or more than 3 days"],
  },
  {
    key: "zaheer", label: "Zaheer (Dysentery)", localName: "زحیر", category: "Amraz-e-Hazm (digestive)", icd: "A03",
    description: "Frequent small stools with mucus or blood and straining (tenesmus).",
    organs: ["Ama"], mizaj: ["Safrawi", "Haar"], type: "Maddi", sabab: ["Infection", "Sharp Safrawi matter irritating the bowel"],
    appliesTo: { complaints: ["dysentery_zaheer", "blood_in_stool_zahir_ud_dam", "loose_motion", "abdominal_cramps_griping_maghas"] },
    signs: [
      S("Mucus or blood in stool", { exam: [ex("baraz", "Mucus"), ex("baraz", "Fresh blood"), ex("baraz", "Mucoid")], complaints: ["dysentery_zaheer", "blood_in_stool_zahir_ud_dam"] }, 3),
      S("Straining and cramps", { complaints: ["abdominal_cramps_griping_maghas"], text: ["straining", "tenesmus"] }),
      S("Fever", { vitals: ["fever", "fever_high"] }),
    ],
    dontMiss: [DEHYDRATION, CANCER_BOWEL], investigations: ["Stool microscopy and culture"],
  },
  {
    key: "bawaseer", label: "Bawaseer (Piles)", localName: "بواسیر", category: "Amraz-e-Hazm (digestive)", icd: "K64",
    description: "Swollen veins at the anus; bleeding (Damiya) or non-bleeding (Amya).",
    organs: ["Ama"], mizaj: ["Saudawi", "Damawi"], type: "Maddi", sabab: ["Constipation and straining", "Saudawi matter", "Sitting long hours", "Pregnancy"],
    appliesTo: { complaints: ["piles", "blood_in_stool_zahir_ud_dam", "painful_defecation_usr_ul_taghwwut", "pruritus_ani_anal_itching_hikka_e_miq_ad", "constipation", "anal_fissure_shiqaq_ul_miq_ad"] },
    signs: [
      S("Piles seen on inspection", { exam: [ex("baraz", "Bleeding piles"), ex("baraz", "Non-bleeding piles")], complaints: ["piles"] }, 4),
      S("Fresh blood with stool", { exam: [ex("baraz", "Fresh blood")], complaints: ["blood_in_stool_zahir_ud_dam"] }),
      S("Constipation", { complaints: ["constipation"], exam: [ex("baraz", "Hard / dry pellets")] }),
    ],
    dontMiss: [CANCER_BOWEL, { label: "Anal fissure or fistula", why: "Sharp pain on passing stool, or a discharging opening near the anus." }], investigations: ["Proctoscopy", "Haemoglobin if bleeding often"],
  },
  {
    key: "yarqan", label: "Yarqan (Jaundice)", localName: "یرقان", category: "Amraz-e-Kabid (liver)", icd: "R17",
    description: "Yellow discoloration of eyes and skin from Safrawi matter spreading in the blood (Yarqan-e-Asfar); dark form Yarqan-e-Aswad.",
    organs: ["Kabid", "Mirarah"], mizaj: ["Safrawi", "Haar"], type: "Maddi", sabab: ["Liver inflammation", "Blocked bile flow", "Excess Safra"],
    appliesTo: { complaints: ["jaundice_yarqan", "yellowish_discoloration_of_eyes_and_skin_sufrat_e_lawn", "liver_swelling_hepatitis_waram_e_kabid", "loss_of_appetite_zo_f_e_ishtaha", "nausea_ghasyan"] },
    signs: [
      S("Yellow eyes or skin", { exam: [ex("zahiri", "Yellow (Yarqan-e-Asfar)"), ex("ayn", "Yellow")], complaints: ["jaundice_yarqan", "yellowish_discoloration_of_eyes_and_skin_sufrat_e_lawn"] }, 4),
      S("Deep yellow, fiery urine", { exam: [ex("baul", "Asfar / Nari")] }, 2),
      S("Pale stools", { exam: [ex("baraz", "Pale / whitish")] }),
      S("Right upper abdominal tenderness", { exam: [ex("batn", "Right upper")] }),
    ],
    dontMiss: [{ label: "Blocked bile duct (stone or tumour)", why: "Jaundice with pale stools, itching, weight loss or pain." }, { label: "Severe liver failure", why: "Jaundice with confusion, drowsiness or bleeding." }], investigations: ["Liver function tests", "Hepatitis serology", "Ultrasound abdomen"],
  },
  {
    key: "zof_e_kabid", label: "Zo'f-e-Kabid (Liver weakness)", localName: "ضعفِ کبد", category: "Amraz-e-Kabid (liver)",
    description: "Weakness of the liver's functions: poor appetite, pallor, puffiness and weak digestion.",
    organs: ["Kabid"], mizaj: ["Barid", "Ratab", "Balghami"], type: "Sada", sabab: ["Cold temperament of the liver", "Poor diet", "Long illness"],
    appliesTo: { complaints: ["liver_weakness_zo_f_e_kabid", "loss_of_appetite_zo_f_e_ishtaha", "loss_of_appetite_zu_f_e_ishtiha", "anemia_faqr_ud_dam", "general_weakness", "swelling_edema_waram"] },
    signs: [
      S("Pallor", { exam: [ex("zahiri", "Pale, white"), ex("zahiri", "Marked pallor"), ex("lisan", "Pale / whitish")] }, 2),
      S("Puffiness or swelling", { exam: [ex("ayn", "Marked puffiness"), ex("zahiri", "puffiness")], complaints: ["swelling_edema_waram"] }),
      S("Poor appetite", { complaints: ["loss_of_appetite_zo_f_e_ishtaha", "loss_of_appetite_zu_f_e_ishtiha"] }),
    ],
    dontMiss: [{ label: "Chronic liver disease", why: "Swelling of the abdomen, yellow eyes or a history of alcohol or hepatitis." }], investigations: ["Liver function tests", "Haemoglobin"],
  },
  {
    key: "waram_e_kabid", label: "Waram-e-Kabid (Hepatitis)", localName: "ورمِ کبد", category: "Amraz-e-Kabid (liver)", icd: "K75.9",
    description: "Inflammation of the liver: right upper pain, fever, nausea, sometimes jaundice.",
    organs: ["Kabid"], mizaj: ["Haar", "Damawi", "Safrawi"], type: "Maddi", sabab: ["Infection", "Hot, sharp matter", "Alcohol or medicines"],
    appliesTo: { complaints: ["liver_swelling_hepatitis_waram_e_kabid", "jaundice_yarqan", "abdominal_pain", "fever", "tension_fullness_in_hypochondrium_tanaffukh_e_mar_qq"] },
    signs: [
      S("Right upper abdominal tenderness", { exam: [ex("batn", "Right upper")], regions: ["Right upper", "Liver"] }, 3),
      S("Liver felt below the ribs", { exam: [ex("batn", "Liver enlarged")] }, 3),
      S("Fever", { vitals: ["fever", "fever_high"] }),
      S("Yellow eyes", { exam: [ex("zahiri", "Yellow"), ex("ayn", "Yellow")] }),
    ],
    dontMiss: [{ label: "Liver abscess", why: "High fever with right upper pain." }], investigations: ["Liver function tests", "Hepatitis serology", "Ultrasound abdomen"],
  },
  {
    key: "hasat_e_marara", label: "Hasat-e-Marara (Gallstones)", localName: "حصاۃِ مرارہ", category: "Amraz-e-Kabid (liver)", icd: "K80",
    description: "Stones in the gall bladder: right upper pain after fatty food, nausea.",
    organs: ["Mirarah", "Kabid"], mizaj: ["Safrawi", "Balghami"], type: "Maddi", sabab: ["Thick (Ghaleez) bile", "Fatty, heavy food", "Obesity"],
    appliesTo: { complaints: ["gallstone_pain_hasat_e_marara", "abdominal_pain", "tension_fullness_in_hypochondrium_tanaffukh_e_mar_qq", "nausea_ghasyan"] },
    signs: [
      S("Right upper pain, worse after fatty food", { complaints: ["gallstone_pain_hasat_e_marara"], worse: ["fat", "oily", "fried"], exam: [ex("batn", "Right upper")] }, 3),
      S("Nausea or vomiting", { complaints: ["nausea_ghasyan", "vomiting"] }),
    ],
    dontMiss: [{ label: "Infected gall bladder (cholecystitis)", why: "Right upper pain with fever or jaundice." }, MI], investigations: ["Ultrasound abdomen", "Liver function tests"],
  },
  {
    key: "qulanj", label: "Qulanj (Colic)", localName: "قولنج", category: "Amraz-e-Hazm (digestive)", icd: "R10.4",
    description: "Severe twisting abdominal pain from trapped wind, thick matter or obstruction in the bowel.",
    organs: ["Ama"], mizaj: ["Barid", "Balghami"], type: "Maddi", sabab: ["Thick (Ghaleez) matter", "Trapped wind (Riyah)", "Cold", "Constipation"],
    appliesTo: { complaints: ["colic_spasmodic_abdominal_pain_qulanj", "abdominal_pain", "abdominal_cramps_griping_maghas", "flatulence_gas_nafkh_e_shikam", "constipation"] },
    signs: [
      S("Colicky, twisting pain", { complaints: ["colic_spasmodic_abdominal_pain_qulanj", "abdominal_cramps_griping_maghas"], text: ["colic", "twisting", "cramp"] }, 3),
      S("Distended, drum-like abdomen", { exam: [ex("batn", "drum-like")] }, 2),
      S("Better with warmth", { better: ["warm", "hot"] }),
      S("Constipation", { complaints: ["constipation"], exam: [ex("baraz", "Hard / dry pellets")] }),
    ],
    dontMiss: [ACUTE_ABDOMEN, { label: "Kidney stone", why: "Pain from the loin to the groin with blood in urine." }], investigations: ["Ultrasound abdomen", "X-ray abdomen if obstruction suspected"],
  },
  {
    key: "nafkh", label: "Nafkh-e-Shikam (Flatulence, bloating)", localName: "نفخِ شکم", category: "Amraz-e-Hazm (digestive)", icd: "R14",
    description: "Excess wind in the stomach and bowel: bloating, rumbling, discomfort.",
    organs: ["Meda", "Ama"], mizaj: ["Barid", "Saudawi"], type: "Sada", sabab: ["Wind-forming (Nafakh) foods", "Weak digestion", "Cold"],
    appliesTo: { complaints: ["flatulence_gas_nafkh_e_shikam", "rumbling_sounds_in_bowels_qarqara", "excessive_gas_expulsion_riyah_e_ghaleeza", "belching_burping_jusha", "indigestion"] },
    signs: [
      S("Bloating and wind", { complaints: ["flatulence_gas_nafkh_e_shikam", "excessive_gas_expulsion_riyah_e_ghaleeza", "rumbling_sounds_in_bowels_qarqara"] }, 3),
      S("Distended, drum-like abdomen", { exam: [ex("batn", "drum-like")] }, 2),
      S("Worse after pulses, beans or heavy food", { worse: ["pulse", "bean", "dal", "heavy", "milk"] }),
    ],
    dontMiss: [ACUTE_ABDOMEN, { label: "Ovarian or bowel growth", why: "Persistent bloating in a woman over 45, or with weight loss." }], investigations: ["Ultrasound abdomen if persistent"],
  },
  {
    key: "dood_e_ama", label: "Dood-e-Ama (Intestinal worms)", localName: "دیدانِ امعاء", category: "Amraz-e-Hazm (digestive)", icd: "B82",
    description: "Worm infestation: anal itching, abdominal discomfort, pica, poor weight gain in children.",
    organs: ["Ama"], mizaj: ["Balghami"], type: "Maddi", sabab: ["Contaminated food or water", "Excess sweets and moist food"],
    appliesTo: { complaints: ["worm_infestation", "pruritus_ani_anal_itching_hikka_e_miq_ad", "craving_for_non_food_items_pica_gil_khori", "abdominal_pain", "anemia_faqr_ud_dam"] },
    signs: [
      S("Anal itching, worse at night", { complaints: ["pruritus_ani_anal_itching_hikka_e_miq_ad", "worm_infestation"] }, 3),
      S("Craving for non-food items", { complaints: ["craving_for_non_food_items_pica_gil_khori"] }, 2),
      S("Child", { maxAge: 12 }, 1),
    ],
    investigations: ["Stool examination for ova and cysts"],
  },
  // ---------------------------------------------------------------- Respiratory
  {
    key: "nazla_zukam", label: "Nazla-o-Zukam (Common cold, catarrh)", localName: "نزلہ و زکام", category: "Amraz-e-Tanaffus (respiratory)", icd: "J00",
    description: "Thin or thick discharge descending from the head: sneezing, blocked or running nose.",
    organs: ["Dimagh", "Riya"], mizaj: ["Barid", "Balghami"], type: "Maddi", sabab: ["Cold air and change of weather", "Cold, moist foods", "Infection"],
    appliesTo: { complaints: ["common_cold", "nasal_congestion_blocked_nose_insidad_e_anf", "excessive_sneezing_kasrat_e_ataas", "sore_throat", "cold_catarrhal_cough_su_al_e_ratb"] },
    signs: [
      S("Sneezing, running or blocked nose", { complaints: ["common_cold", "nasal_congestion_blocked_nose_insidad_e_anf", "excessive_sneezing_kasrat_e_ataas"] }, 3),
      S("Worse with cold", { worse: ["cold"] }),
      S("Watery eyes", { exam: [ex("ayn", "Watery")] }),
    ],
    against: [S("High fever", { vitals: ["fever_high"] }), S("Low oxygen", { vitals: ["spo2_low"] }, 4)],
    dontMiss: [{ label: "Pneumonia", why: "High fever, fast breathing, chest pain or low oxygen." }], investigations: [],
  },
  {
    key: "suaal_ratb", label: "Su'al-e-Ratb (Productive cough)", localName: "سعالِ رطب", category: "Amraz-e-Tanaffus (respiratory)", icd: "R05",
    description: "Moist cough with phlegm from Balghami matter in the chest.",
    organs: ["Riya"], mizaj: ["Balghami", "Ratab"], type: "Maddi", sabab: ["Cold and damp", "Phlegm descending from the head", "Infection"],
    appliesTo: { complaints: ["cold_catarrhal_cough_su_al_e_ratb", "cough_breathing", "bronchitis_waram_e_sho_ab_e_hawaia", "post_nasal_drip_nuzla_e_muzmin"] },
    signs: [
      S("Cough with phlegm", { complaints: ["cold_catarrhal_cough_su_al_e_ratb"], exam: [ex("naftha", "Thick, sticky"), ex("naftha", "White, clear")], text: ["phlegm", "sputum", "productive"] }, 3),
      S("Worse with cold or at night", { worse: ["cold", "night", "morning"] }),
      S("Better with warm drinks", { better: ["warm", "hot", "steam"] }),
    ],
    against: [S("Dry cough", { complaints: ["dry_cough_su_al_e_yabis"] }, 3)],
    dontMiss: [{ label: "Tuberculosis", why: "Cough over 2 weeks with fever, night sweats, weight loss or blood in sputum." }, { label: "Pneumonia", why: "Fever with yellow or green sputum, fast breathing or low oxygen." }], investigations: ["Chest X-ray and sputum test if over 2 weeks"],
  },
  {
    key: "suaal_yabis", label: "Su'al-e-Yabis (Dry cough)", localName: "سعالِ یابس", category: "Amraz-e-Tanaffus (respiratory)", icd: "R05",
    description: "Dry, irritating cough without phlegm, from dryness and heat in the throat and chest.",
    organs: ["Riya", "Halq"], mizaj: ["Yabis", "Safrawi", "Haar"], type: "Sada", sabab: ["Dry, hot air", "Dust and smoke", "Dryness after an illness", "Some blood-pressure medicines"],
    appliesTo: { complaints: ["dry_cough_su_al_e_yabis", "cough_breathing", "sore_throat", "hoarseness_of_voice_buhhat_us_saut"] },
    signs: [
      S("Dry cough without phlegm", { complaints: ["dry_cough_su_al_e_yabis"], text: ["dry cough"] }, 3),
      S("Dry tongue or throat", { exam: [ex("lisan", "Dry, parched")], complaints: ["dry_mouth_jafaf_ul_fam"] }),
      S("Better with moist, soothing drinks", { better: ["hydration", "water", "honey", "warm water", "moist"] }),
    ],
    against: [S("Thick phlegm", { exam: [ex("naftha", "Thick, sticky")] }, 3)],
    dontMiss: [{ label: "Tuberculosis", why: "Cough over 2 weeks with fever, night sweats or weight loss." }, { label: "Medicine side effect (ACE inhibitor)", why: "Dry cough after starting a blood-pressure medicine such as enalapril or ramipril." }], investigations: ["Chest X-ray if over 2 weeks"],
  },
  {
    key: "rabv", label: "Rabv / Zeeq-un-Nafas (Asthma)", localName: "ربو / ضیق النفس", category: "Amraz-e-Tanaffus (respiratory)", icd: "J45",
    description: "Recurrent narrowing of the airways with wheeze and breathlessness, worse with cold, dust or at night.",
    organs: ["Riya"], mizaj: ["Balghami", "Barid", "Ratab"], type: "Maddi", sabab: ["Thick phlegm in the airways", "Cold air, dust and smoke", "Allergy", "Family history"],
    appliesTo: { complaints: ["asthma_breathlessness", "cough_breathing", "orthopnea_breathlessness_on_lying_flat_intisab_un_nafas", "bronchitis_waram_e_sho_ab_e_hawaia"], symptoms: ["Breathless", "Wheez"] },
    signs: [
      S("Wheeze on listening", { exam: [ex("naftha", "Wheeze")] }, 4),
      S("Episodes of breathlessness", { complaints: ["asthma_breathlessness"], text: ["breathless", "wheez", "tight chest"] }, 3),
      S("Worse with cold, dust or at night", { worse: ["cold", "dust", "night", "smoke", "exertion"] }),
      S("Known asthma", { conditions: ["asthma"] }, 3),
    ],
    against: [S("Swollen feet (heart cause more likely)", { exam: [ex("zahiri", "Pitting swelling")] }, 3)],
    dontMiss: [SEVERE_ASTHMA, { label: "Heart failure", why: "Breathlessness lying flat, swollen feet, crackles." }], investigations: ["Peak flow or spirometry"],
  },
  {
    key: "zaat_ur_riya", label: "Zaat-ur-Riya (Pneumonia)", localName: "ذات الریہ", category: "Amraz-e-Tanaffus (respiratory)", icd: "J18",
    description: "Inflammation of the lung: fever, cough with coloured sputum, fast breathing, chest pain.",
    organs: ["Riya"], mizaj: ["Haar", "Damawi", "Safrawi"], type: "Maddi", sabab: ["Infection", "Hot matter collecting in the lung"],
    appliesTo: { complaints: ["pneumonia_zaat_ur_riya", "cough_breathing", "fever", "pleurisy_side_pain_zaat_ul_janb", "chills_rigors_qusha_reera"] },
    signs: [
      S("Fever", { vitals: ["fever", "fever_high"], complaints: ["fever"] }, 3),
      S("Yellow or green sputum", { exam: [ex("naftha", "Yellow"), ex("naftha", "Green")] }, 3),
      S("Crackles or reduced air entry", { exam: [ex("naftha", "Crackles"), ex("naftha", "Reduced air entry")] }, 4),
      S("Fast or laboured breathing", { exam: [ex("naftha", "Laboured"), ex("naftha", "Slightly fast")] }, 2),
      S("Low oxygen", { vitals: ["spo2_low", "spo2_borderline"] }, 3),
    ],
    dontMiss: [SEVERE_ASTHMA, { label: "Sepsis", why: "Fever with confusion, low blood pressure or very fast pulse." }], investigations: ["Chest X-ray", "Blood count", "Oxygen saturation monitoring"],
  },
  {
    key: "waram_e_lauzatain", label: "Waram-e-Lauzatain / Waja-ul-Halaq (Tonsillitis, sore throat)", localName: "ورمِ لوزتین", category: "Amraz-e-Halq (throat)", icd: "J03",
    description: "Inflamed throat or tonsils: pain on swallowing, fever.",
    organs: ["Halq"], mizaj: ["Damawi", "Haar"], type: "Maddi", sabab: ["Infection", "Cold drinks after heat", "Hot matter in the throat"],
    appliesTo: { complaints: ["tonsillitis_waram_e_lauzatain", "sore_throat", "difficulty_swallowing_usr_ul_bala", "hoarseness_of_voice_buhhat_us_saut", "fever"] },
    signs: [
      S("Sore throat, pain on swallowing", { complaints: ["tonsillitis_waram_e_lauzatain", "sore_throat", "difficulty_swallowing_usr_ul_bala"] }, 3),
      S("Fever", { vitals: ["fever", "fever_high"] }),
      S("Tender, enlarged neck glands", { exam: [ex("zahiri", "Tender, enlarged")] }, 2),
    ],
    dontMiss: [{ label: "Throat abscess", why: "Unable to swallow saliva, muffled voice or one-sided swelling." }], investigations: ["Throat swab if recurrent"],
  },
  {
    key: "nazla_muzmin", label: "Nazla-e-Muzmin (Sinusitis, chronic catarrh)", localName: "نزلۂ مزمن", category: "Amraz-e-Tanaffus (respiratory)", icd: "J32",
    description: "Long-standing catarrh with heaviness of the head, blocked nose and post-nasal drip.",
    organs: ["Dimagh"], mizaj: ["Balghami", "Barid"], type: "Maddi", sabab: ["Cold, moist brain temperament", "Repeated colds", "Dust and allergy"],
    appliesTo: { complaints: ["sinusitis_chronic_catarrh_nazla", "post_nasal_drip_nuzla_e_muzmin", "nasal_congestion_blocked_nose_insidad_e_anf", "heaviness_in_head_siqal_e_ra_s", "headache"] },
    signs: [
      S("Heaviness of the head or forehead", { complaints: ["heaviness_in_head_siqal_e_ra_s"], exam: [ex("asab", "Forehead"), ex("asab", "Whole head, heavy")] }, 3),
      S("Post-nasal drip or blocked nose", { complaints: ["post_nasal_drip_nuzla_e_muzmin", "nasal_congestion_blocked_nose_insidad_e_anf", "sinusitis_chronic_catarrh_nazla"] }, 3),
      S("Worse with cold or in the morning", { worse: ["cold", "morning"] }),
    ],
    investigations: ["X-ray or CT sinuses if persistent"],
  },
  // ---------------------------------------------------------------- Joints & muscles
  {
    key: "waja_ul_mafasil_barid", label: "Waja-ul-Mafasil Barid (Cold-type arthritis)", localName: "وجع المفاصل بارد", category: "Amraz-e-Mafasil (joints)", icd: "M19",
    description: "Joint pain and stiffness from cold, moist (Balghami) matter: swollen but cool joints, worse with cold and damp.",
    organs: ["Mafasil"], mizaj: ["Balghami", "Barid", "Ratab"], type: "Maddi", sabab: ["Balghami matter in the joints", "Cold and damp", "Inactivity", "Weak digestion"],
    appliesTo: { complaints: ["joint_pain", "knee_pain_waja_ur_rukba", "joint_swelling_arthritis_waram_e_mafasil", "stiff_joints_rigidity_tahajjar_e_mafasil", "back_pain", "hip_pain_waja_ul_wark", "shoulder_pain_waja_ul_katif"], categories: ["Musculoskeletal"] },
    signs: [
      S("Swollen, cool, soft joints", { exam: [ex("mafasil", "Swollen, cool, soft")] }, 4),
      S("Worse with cold or damp", { worse: ["cold", "damp", "winter", "morning", "rest"] }, 3),
      S("Better with warmth", { better: ["warm", "hot", "heat", "movement"] }, 3),
      S("Morning stiffness", { text: ["stiff", "morning"], complaints: ["stiff_joints_rigidity_tahajjar_e_mafasil"] }),
    ],
    against: [S("Hot, red joints", { exam: [ex("mafasil", "Hot, red, swollen")] }, 4), S("Better with cold", { better: ["cold"] }, 3)],
    dontMiss: [{ label: "Joint infection", why: "One hot, very painful joint with fever." }, { label: "Rheumatoid arthritis", why: "Small joints of both hands swollen with long morning stiffness." }], investigations: ["ESR / CRP", "Rheumatoid factor if small joints", "X-ray of the affected joint"],
  },
  {
    key: "waja_ul_mafasil_haar", label: "Waja-ul-Mafasil Haar (Hot-type arthritis)", localName: "وجع المفاصل حار", category: "Amraz-e-Mafasil (joints)", icd: "M13",
    description: "Joint pain from hot (Damawi or Safrawi) matter: hot, red, swollen joints, better with cold.",
    organs: ["Mafasil"], mizaj: ["Damawi", "Safrawi", "Haar"], type: "Maddi", sabab: ["Hot matter in the joints", "Hot, rich food", "Infection"],
    appliesTo: { complaints: ["joint_pain", "joint_swelling_arthritis_waram_e_mafasil", "knee_pain_waja_ur_rukba", "gout_niqras", "ankle_pain_waja_ul_ka_b", "wrist_pain_waja_ul_rusgh"], categories: ["Musculoskeletal"] },
    signs: [
      S("Hot, red, swollen joints", { exam: [ex("mafasil", "Hot, red, swollen")] }, 4),
      S("Better with cold", { better: ["cold", "ice"] }, 3),
      S("Worse with heat or rich food", { worse: ["heat", "hot", "meat", "rich"] }),
      S("Fever", { vitals: ["fever", "fever_high"] }),
    ],
    against: [S("Better with warmth", { better: ["warm", "heat", "hot"] }, 3)],
    dontMiss: [{ label: "Joint infection", why: "One hot, very painful joint with fever — needs urgent care." }, { label: "Rheumatic fever", why: "Child or young adult with moving joint pain after a sore throat." }], investigations: ["ESR / CRP", "Uric acid", "Joint aspiration if infection suspected"],
  },
  {
    key: "niqras", label: "Niqras (Gout)", localName: "نقرس", category: "Amraz-e-Mafasil (joints)", icd: "M10",
    description: "Sudden very painful, hot, swollen joint, typically the big toe.",
    organs: ["Mafasil"], mizaj: ["Damawi", "Safrawi"], type: "Maddi", sabab: ["Rich food, meat and alcohol", "Hot matter in the joint", "Kidney weakness"],
    appliesTo: { complaints: ["gout_niqras", "joint_pain", "joint_swelling_arthritis_waram_e_mafasil", "ankle_pain_waja_ul_ka_b"] },
    signs: [
      S("Big toe affected", { exam: [ex("mafasil", "Big toe")], complaints: ["gout_niqras"] }, 4),
      S("Hot, red, swollen joint", { exam: [ex("mafasil", "Hot, red, swollen")] }, 3),
      S("High uric acid or known gout", { conditions: ["gout"] }, 3),
    ],
    dontMiss: [{ label: "Joint infection", why: "Hot swollen joint with fever." }], investigations: ["Serum uric acid", "Kidney function"],
  },
  {
    key: "irq_un_nasa", label: "Irq-un-Nasa (Sciatica)", localName: "عرق النسا", category: "Amraz-e-A'sab (nerves)", icd: "M54.3",
    description: "Pain from the lower back or hip running down the back of the leg.",
    organs: ["A'sab", "Mafasil"], mizaj: ["Balghami", "Barid", "Saudawi"], type: "Maddi", sabab: ["Cold, thick matter pressing on the nerve", "Lifting and strain", "Long sitting"],
    appliesTo: { complaints: ["sciatica", "back_pain", "hip_pain_waja_ul_wark", "sciatic_cramps_leg_spasms_iltiwa_ul_asab", "numbness_tingling_khadar"] },
    signs: [
      S("Pain running down the leg", { complaints: ["sciatica", "sciatic_cramps_leg_spasms_iltiwa_ul_asab"], text: ["radiat", "down the leg", "leg pain"] }, 4),
      S("Back pain", { complaints: ["back_pain"], exam: [ex("mafasil", "Spine / back")] }),
      S("Worse with cold or sitting", { worse: ["cold", "sitting", "bending"] }),
    ],
    dontMiss: [CAUDA], investigations: ["X-ray or MRI of the lower spine if weakness or no improvement in 6 weeks"],
  },
  {
    key: "waja_ul_zahr", label: "Waja-ul-Zahr (Low back pain)", localName: "وجع الظہر", category: "Amraz-e-Mafasil (joints)", icd: "M54.5",
    description: "Pain and stiffness in the lower back.",
    organs: ["Mafasil"], mizaj: ["Barid", "Ratab", "Saudawi"], type: "Sada", sabab: ["Strain and poor posture", "Cold", "Weak kidneys (classical)"],
    appliesTo: { complaints: ["back_pain", "tailbone_pain_coccydynia_waja_ul_us_us", "hip_pain_waja_ul_wark"] },
    signs: [
      S("Lower back pain", { complaints: ["back_pain"], exam: [ex("mafasil", "Spine / back")], regions: ["Lower back", "Lumbar"] }, 3),
      S("Worse with cold or rest, better with movement or warmth", { worse: ["cold", "rest", "morning"], better: ["warm", "movement", "massage"] }),
    ],
    dontMiss: [CAUDA, { label: "Spinal infection or cancer", why: "Back pain with fever, weight loss, night pain or age over 50 with new pain." }, { label: "Kidney stone or infection", why: "Loin pain with urinary symptoms or fever." }], investigations: ["X-ray if over 50, injury or red flags"],
  },
  {
    key: "khushunat_e_mafasil", label: "Khushunat-o-Tahajjur-e-Mafasil (Osteoarthritis)", localName: "خشونتِ مفاصل", category: "Amraz-e-Mafasil (joints)", icd: "M17",
    description: "Wear and dryness of the joint in later life: pain on use, stiffness, creaking, mainly knees and hips.",
    organs: ["Mafasil"], mizaj: ["Saudawi", "Yabis", "Barid"], type: "Sada", sabab: ["Age and dryness of the joint", "Excess weight", "Old injury"],
    appliesTo: { complaints: ["knee_pain_waja_ur_rukba", "joint_pain", "hip_pain_waja_ul_wark", "stiff_joints_rigidity_tahajjar_e_mafasil"] },
    signs: [
      S("Knee or hip affected", { exam: [ex("mafasil", "Knees"), ex("mafasil", "Hips")], complaints: ["knee_pain_waja_ur_rukba", "hip_pain_waja_ul_wark"] }, 3),
      S("Age over 45", { minAge: 45 }, 2),
      S("Not swollen but stiff, restricted movement", { exam: [ex("mafasil", "Not swollen, stiff"), ex("mafasil", "Mildly restricted")] }, 2),
      S("Worse with use, stairs or walking", { worse: ["walk", "stairs", "standing", "exertion"] }),
    ],
    against: [S("Hot, red joint", { exam: [ex("mafasil", "Hot, red, swollen")] }, 3)],
    dontMiss: [{ label: "Inflammatory arthritis", why: "Several swollen joints with long morning stiffness." }], investigations: ["X-ray of the joint"],
  },
  // ---------------------------------------------------------------- Brain & nerves
  {
    key: "suda_haar", label: "Suda'-e-Haar (Hot-type headache)", localName: "صداعِ حار", category: "Amraz-e-Dimagh (brain)", icd: "R51",
    description: "Headache from heat: burning, red face, thirst, worse in heat and sun, better with cold.",
    organs: ["Dimagh"], mizaj: ["Safrawi", "Damawi", "Haar"], type: "Sada", sabab: ["Sun and heat", "Hot food", "Anger and sleeplessness", "Fever"],
    appliesTo: { complaints: ["headache", "migraine_one_sided_headache_shaqeeqa", "tension_headache_band_like_headache_baiza", "sunstroke_heat_exhaustion_zarb_e_shams"] },
    signs: [
      S("Headache worse with heat or sun", { worse: ["heat", "sun", "hot"] }, 3),
      S("Better with cold", { better: ["cold"] }, 3),
      S("Red, flushed face", { exam: [ex("zahiri", "Red, flushed")] }, 2),
      S("Fast, warm pulse", { exam: [ex("nabz", "Saree'"), ex("nabz", "Haar (Warm)")] }),
    ],
    against: [S("Better with warmth", { better: ["warm"] }, 3)],
    dontMiss: [MENINGITIS, { label: "Bleeding in the brain", why: "Sudden, worst-ever headache or headache with weakness or confusion." }, { label: "Very high blood pressure", why: "Headache with BP 180/110 or more." }], investigations: ["Blood pressure", "Eye check if visual symptoms"],
  },
  {
    key: "suda_barid", label: "Suda'-e-Barid (Cold-type headache)", localName: "صداعِ بارد", category: "Amraz-e-Dimagh (brain)", icd: "R51",
    description: "Headache from cold and phlegm: heavy, dull, with catarrh, worse in cold, better with warmth.",
    organs: ["Dimagh"], mizaj: ["Balghami", "Barid"], type: "Maddi", sabab: ["Cold air", "Catarrh", "Cold, moist food"],
    appliesTo: { complaints: ["headache", "heaviness_in_head_siqal_e_ra_s", "sinusitis_chronic_catarrh_nazla", "common_cold"] },
    signs: [
      S("Heavy, dull head", { complaints: ["heaviness_in_head_siqal_e_ra_s"], exam: [ex("asab", "Whole head, heavy")] }, 3),
      S("Worse with cold", { worse: ["cold"] }, 3),
      S("Better with warmth", { better: ["warm", "hot"] }, 3),
      S("Catarrh or blocked nose", { complaints: ["common_cold", "sinusitis_chronic_catarrh_nazla", "nasal_congestion_blocked_nose_insidad_e_anf"] }),
    ],
    against: [S("Better with cold", { better: ["cold"] }, 3)],
    dontMiss: [MENINGITIS], investigations: [],
  },
  {
    key: "shaqeeqa", label: "Shaqeeqa (Migraine)", localName: "شقیقہ", category: "Amraz-e-Dimagh (brain)", icd: "G43",
    description: "Recurrent one-sided throbbing headache, often with nausea and sensitivity to light.",
    organs: ["Dimagh"], mizaj: ["Safrawi", "Saudawi"], type: "Maddi", sabab: ["Vapours (Bukharat) rising from the stomach", "Sleeplessness", "Hunger", "Stress"],
    appliesTo: { complaints: ["migraine_one_sided_headache_shaqeeqa", "headache", "intolerance_to_light_photophobia_khauf_uz_zau", "nausea_ghasyan"] },
    signs: [
      S("One-sided or temple headache", { complaints: ["migraine_one_sided_headache_shaqeeqa"], exam: [ex("asab", "Temples / one side")] }, 4),
      S("Sensitivity to light", { complaints: ["intolerance_to_light_photophobia_khauf_uz_zau"], text: ["light"] }, 2),
      S("Nausea or vomiting with the headache", { complaints: ["nausea_ghasyan", "vomiting"] }),
      S("Recurrent episodes", { text: ["recurrent", "episod", "attacks"] }),
    ],
    dontMiss: [{ label: "Bleeding in the brain", why: "Sudden, worst-ever headache." }, MENINGITIS, STROKE], investigations: ["Brain scan only if red flags"],
  },
  {
    key: "dawar", label: "Dawar (Vertigo)", localName: "دوار", category: "Amraz-e-Dimagh (brain)", icd: "R42",
    description: "Spinning or swaying sensation, worse on moving the head.",
    organs: ["Dimagh", "Uzn"], mizaj: ["Balghami", "Safrawi"], type: "Maddi", sabab: ["Vapours rising to the head", "Weak stomach", "Inner ear disturbance"],
    appliesTo: { complaints: ["dizziness_vertigo_dawar", "ringing_in_ears_tinnitus_taneen", "nausea_ghasyan", "fainting_syncope_ghashi"] },
    signs: [
      S("Spinning, worse on moving the head", { complaints: ["dizziness_vertigo_dawar"], worse: ["head movement", "turning", "lying"] }, 3),
      S("Ringing in the ears", { complaints: ["ringing_in_ears_tinnitus_taneen"] }),
      S("Nausea", { complaints: ["nausea_ghasyan"] }),
    ],
    dontMiss: [STROKE, { label: "Low blood pressure or heart rhythm problem", why: "Dizziness on standing, fainting, palpitations or irregular pulse." }], investigations: ["Blood pressure lying and standing", "Ear examination"],
  },
  {
    key: "sahar", label: "Sahar (Insomnia)", localName: "سہر", category: "Amraz-e-Dimagh (brain)", icd: "G47.0",
    description: "Difficulty falling or staying asleep from dryness and heat of the brain, worry or pain.",
    organs: ["Dimagh"], mizaj: ["Yabis", "Safrawi", "Saudawi"], type: "Sada", sabab: ["Worry and grief", "Dryness of the brain", "Tea or coffee late", "Pain"],
    appliesTo: { complaints: ["insomnia", "anxiety_stress", "low_mood", "restlessness_agitation_karb"] },
    signs: [
      S("Difficulty sleeping", { complaints: ["insomnia"], text: ["sleepless", "insomnia", "can't sleep", "cannot sleep"] }, 3),
      S("Restless or anxious manner", { exam: [ex("asab", "Restless, irritable"), ex("asab", "Withdrawn, anxious")], complaints: ["anxiety_stress"] }),
      S("Dry skin or tongue", { exam: [ex("lisan", "Dry, parched"), ex("zahiri", "Hot and dry"), ex("zahiri", "Cool and dry")] }),
    ],
    dontMiss: [{ label: "Depression", why: "Low mood, loss of interest, early waking or thoughts of self-harm." }, { label: "Overactive thyroid", why: "Weight loss, tremor, fast pulse, heat intolerance." }], investigations: ["Thyroid test if tremor or weight loss"],
  },
  {
    key: "malikholia", label: "Malikholia (Melancholia, low mood)", localName: "مالیخولیا", category: "Amraz-e-Dimagh (brain)", icd: "F32",
    description: "Persistent sadness, fear and withdrawal attributed to Saudawi matter affecting the brain.",
    organs: ["Dimagh"], mizaj: ["Saudawi", "Yabis", "Barid"], type: "Maddi", sabab: ["Saudawi matter", "Grief and loss", "Loneliness", "Long illness"],
    appliesTo: { complaints: ["low_mood", "anxiety_stress", "insomnia", "hypochondriasis_maraqiya", "forgetfulness_amnesia_nisyan"] },
    signs: [
      S("Low mood or withdrawal", { complaints: ["low_mood"], exam: [ex("asab", "Withdrawn, anxious"), ex("asab", "Slow, dull, sleepy")] }, 4),
      S("Dark, dusky complexion or dry skin", { exam: [ex("zahiri", "Dark, dusky"), ex("zahiri", "Cool and dry")] }),
      S("Poor sleep", { complaints: ["insomnia"] }),
    ],
    dontMiss: [{ label: "Risk of self-harm", why: "Ask directly about thoughts of ending life; refer urgently if present." }, { label: "Underactive thyroid", why: "Tiredness, weight gain, cold intolerance." }], investigations: ["Thyroid test", "Haemoglobin"],
  },
  {
    key: "waswas", label: "Waswas / Qalaq (Anxiety)", localName: "وسواس / قلق", category: "Amraz-e-Dimagh (brain)", icd: "F41",
    description: "Persistent worry, restlessness and fear, often with palpitations and poor sleep.",
    organs: ["Dimagh", "Qalb"], mizaj: ["Saudawi", "Safrawi"], type: "Sada", sabab: ["Worry and stress", "Saudawi vapours", "Sleeplessness", "Caffeine"],
    appliesTo: { complaints: ["anxiety_stress", "palpitations", "insomnia", "restlessness_agitation_karb", "throat_choking_globus_hystericus_ikhtinaq_ur_rahem"] },
    signs: [
      S("Worry, restlessness", { complaints: ["anxiety_stress", "restlessness_agitation_karb"], exam: [ex("asab", "Restless, irritable"), ex("asab", "Withdrawn, anxious")] }, 4),
      S("Palpitations", { complaints: ["palpitations"] }),
      S("Fine tremor", { exam: [ex("asab", "Fine tremor")] }),
    ],
    dontMiss: [{ label: "Overactive thyroid", why: "Weight loss, tremor, heat intolerance, fast pulse." }, { label: "Heart rhythm problem", why: "Irregular pulse, fainting or chest pain." }], investigations: ["Thyroid test", "ECG if palpitations"],
  },
  {
    key: "falij", label: "Falij (Paralysis, hemiplegia)", localName: "فالج", category: "Amraz-e-A'sab (nerves)", icd: "G81",
    description: "Loss of movement on one side of the body.",
    organs: ["A'sab", "Dimagh"], mizaj: ["Balghami", "Barid", "Ratab"], type: "Maddi", sabab: ["Blocked flow of Ruh to the nerves (classical)", "Stroke", "High blood pressure"],
    appliesTo: { complaints: ["paralysis_hemiplegia_falij", "facial_paralysis_laqwa", "stroke_apoplexy_sakta", "heaviness_of_tongue_slurred_speech_thuql_e_lisan", "numbness_tingling_khadar"] },
    signs: [
      S("Weakness of one side", { complaints: ["paralysis_hemiplegia_falij", "stroke_apoplexy_sakta"] }, 4),
      S("Slurred speech or facial droop", { complaints: ["heaviness_of_tongue_slurred_speech_thuql_e_lisan", "facial_paralysis_laqwa"] }, 3),
      S("High blood pressure", { vitals: ["bp_high", "bp_very_high"], conditions: ["hypertension"] }),
    ],
    dontMiss: [STROKE], investigations: ["Emergency brain scan if new (within hours)", "Blood pressure, sugar, lipids"],
  },
  {
    key: "khadar", label: "Khadar / Waja-ul-A'sab (Nerve pain, numbness)", localName: "خدر", category: "Amraz-e-A'sab (nerves)", icd: "G62",
    description: "Numbness, tingling or burning of hands and feet, often from long-standing diabetes or cold, dry nerves.",
    organs: ["A'sab"], mizaj: ["Barid", "Saudawi", "Yabis"], type: "Sada", sabab: ["Diabetes", "Cold and dryness of the nerves", "Vitamin B12 deficiency"],
    appliesTo: { complaints: ["numbness_tingling_khadar", "burning_sensation_in_soles_hurqat_ul_qadam", "nerve_pain_neuralgia_waja_ul_asab", "nerve_weakness_neurasthenia_zo_f_e_asab"] },
    signs: [
      S("Numbness or tingling", { complaints: ["numbness_tingling_khadar", "burning_sensation_in_soles_hurqat_ul_qadam"] }, 3),
      S("Reduced sensation, glove-and-stocking", { exam: [ex("asab", "glove-and-stocking")] }, 4),
      S("Diabetes", { conditions: ["diabetes"] }, 3),
    ],
    dontMiss: [STROKE, CAUDA], investigations: ["Blood sugar / HbA1c", "Vitamin B12"],
  },
  // ---------------------------------------------------------------- Skin
  {
    key: "bars", label: "Bars (Vitiligo)", localName: "برص", category: "Amraz-e-Jild (skin)", icd: "L80",
    description: "White patches of skin from loss of pigment, attributed to cold, moist matter.",
    organs: ["Jild"], mizaj: ["Balghami", "Barid", "Ratab"], type: "Maddi", sabab: ["Balghami matter", "Weak liver (classical)", "Family history"],
    appliesTo: { complaints: ["white_patches_vitiligo_bars", "pityriasis_versicolor_fungal_patches_bahaq"] },
    signs: [S("White patches", { complaints: ["white_patches_vitiligo_bars"], text: ["white patch"] }, 4)],
    dontMiss: [{ label: "Fungal infection (pityriasis versicolor)", why: "Scaly, faint patches that are not fully white." }, { label: "Leprosy", why: "Pale patch with loss of sensation." }], investigations: ["Wood's lamp examination", "Thyroid test"],
  },
  {
    key: "nar_e_farsi", label: "Nar-e-Farsi (Eczema)", localName: "نارِ فارسی", category: "Amraz-e-Jild (skin)", icd: "L30.9",
    description: "Itchy, inflamed skin that may ooze (moist) or become dry, thick and scaly.",
    organs: ["Jild"], mizaj: ["Safrawi", "Saudawi"], type: "Maddi", sabab: ["Sharp, burnt matter in the blood", "Irritants and allergy", "Dryness"],
    appliesTo: { complaints: ["eczema_nar_e_farsi", "skin_rash_itching", "skin_dryness_yubusat_e_jild"] },
    signs: [
      S("Itchy rash", { complaints: ["eczema_nar_e_farsi", "skin_rash_itching"] }, 3),
      S("Thickened skin or scratch marks", { exam: [ex("jild", "Thickened, leathery"), ex("jild", "Fresh scratch marks")] }, 3),
      S("Oozing or dry, scaly lesions", { exam: [ex("jild", "Moist, oozing"), ex("jild", "Dry, scaly, dark")] }),
    ],
    dontMiss: [{ label: "Skin infection", why: "Rapidly spreading redness, pus or fever." }], investigations: [],
  },
  {
    key: "da_us_sadaf", label: "Da-us-Sadaf (Psoriasis)", localName: "داء الصدف", category: "Amraz-e-Jild (skin)", icd: "L40",
    description: "Thick, dry, silvery scaly plaques, attributed to Saudawi matter.",
    organs: ["Jild"], mizaj: ["Saudawi", "Yabis"], type: "Maddi", sabab: ["Saudawi matter", "Stress", "Family history"],
    appliesTo: { complaints: ["psoriasis_da_us_sadaf", "skin_rash_itching", "skin_dryness_yubusat_e_jild", "dandruff_huzaz"] },
    signs: [
      S("Dry, scaly, dark lesions", { exam: [ex("jild", "Dry, scaly, dark")], complaints: ["psoriasis_da_us_sadaf"] }, 4),
      S("Thickened skin", { exam: [ex("jild", "Thickened, leathery")] }),
      S("Nail changes", { exam: [ex("zahiri", "Brittle, ridged")] }),
    ],
    dontMiss: [{ label: "Psoriatic arthritis", why: "Joint pain or swelling with psoriasis." }], investigations: [],
  },
  {
    key: "busoor_dammal", label: "Busoor-o-Dammal (Acne, boils)", localName: "بثور و دمامیل", category: "Amraz-e-Jild (skin)", icd: "L70",
    description: "Red, raised, hot pimples or boils from hot, excess blood (Damawi) or Safrawi matter.",
    organs: ["Jild"], mizaj: ["Damawi", "Safrawi"], type: "Maddi", sabab: ["Hot, rich, oily food", "Excess blood", "Hormonal change"],
    appliesTo: { complaints: ["boils_acne", "abscess_khuraj", "carbuncle_jamra"] },
    signs: [
      S("Red, raised, hot lesions", { exam: [ex("jild", "Red, raised, hot")], complaints: ["boils_acne"] }, 4),
      S("Yellowish pustules", { exam: [ex("jild", "yellowish pustules")] }, 2),
      S("Worse with oily or hot food", { worse: ["oily", "fried", "spicy", "sweet"] }),
    ],
    dontMiss: [{ label: "Spreading infection (cellulitis) or diabetes", why: "Recurrent boils, spreading redness or fever — check blood sugar." }], investigations: ["Blood sugar if recurrent boils"],
  },
  {
    key: "jarab_hikka", label: "Jarab / Hikka (Scabies, generalised itching)", localName: "جرب / حکہ", category: "Amraz-e-Jild (skin)", icd: "B86",
    description: "Intense itching, worse at night; scabies spreads to family members.",
    organs: ["Jild"], mizaj: ["Safrawi", "Saudawi"], type: "Maddi", sabab: ["Mite infestation", "Sharp, salty matter in the blood"],
    appliesTo: { complaints: ["scabies_jarab", "skin_rash_itching"] },
    signs: [
      S("Itching worse at night", { worse: ["night"], complaints: ["scabies_jarab"] }, 3),
      S("Lesions in skin folds", { exam: [ex("jild", "In skin folds")] }, 3),
      S("Fresh scratch marks", { exam: [ex("jild", "Fresh scratch marks")] }),
    ],
    dontMiss: [{ label: "Liver or kidney disease", why: "Itching without a rash, with jaundice or swelling." }], investigations: ["Liver and kidney tests if itching without rash"],
  },
  {
    key: "shara", label: "Shara (Urticaria, hives)", localName: "شری", category: "Amraz-e-Jild (skin)", icd: "L50",
    description: "Raised, itchy welts that come and go, from hot, sharp vapours in the blood.",
    organs: ["Jild"], mizaj: ["Safrawi", "Damawi"], type: "Maddi", sabab: ["Allergy to food or medicine", "Hot, sharp matter", "Heat"],
    appliesTo: { complaints: ["urticaria_hives_shara", "skin_rash_itching"] },
    signs: [
      S("Raised welts that come and go", { complaints: ["urticaria_hives_shara"], text: ["welt", "hive"] }, 4),
      S("Red, raised lesions", { exam: [ex("jild", "Red, raised, hot")] }),
    ],
    dontMiss: [{ label: "Severe allergic reaction (anaphylaxis)", why: "Swelling of lips or tongue, breathing difficulty or faintness — emergency." }], investigations: [],
  },
  {
    key: "qooba", label: "Qooba (Ringworm)", localName: "قوبا", category: "Amraz-e-Jild (skin)", icd: "B35",
    description: "Itchy, ring-shaped scaly patches from fungal infection.",
    organs: ["Jild"], mizaj: ["Saudawi", "Balghami"], type: "Maddi", sabab: ["Fungal infection", "Moisture and sweat", "Shared clothes or towels"],
    appliesTo: { complaints: ["ringworm_qooba", "skin_rash_itching", "nail_discoloration_fungal_infection_qooba_e_azfar"] },
    signs: [
      S("Ring-shaped scaly patch", { complaints: ["ringworm_qooba"], text: ["ring"] }, 4),
      S("In skin folds", { exam: [ex("jild", "In skin folds")] }, 2),
    ],
    dontMiss: [{ label: "Diabetes", why: "Recurrent or widespread fungal infections — check blood sugar." }], investigations: ["Skin scraping (KOH) if unsure", "Blood sugar if recurrent"],
  },
  // ---------------------------------------------------------------- Urinary
  {
    key: "hasat_e_kulya", label: "Hasat-e-Kulya (Kidney stone)", localName: "حصاۃِ کلیہ", category: "Amraz-e-Kulya-o-Masana (urinary)", icd: "N20",
    description: "Stone in the kidney or ureter: severe colicky loin pain to the groin, blood or gravel in urine.",
    organs: ["Kulya", "Masana"], mizaj: ["Balghami", "Saudawi"], type: "Maddi", sabab: ["Thick (Ghaleez) matter", "Too little water", "Heat and sweating", "Diet"],
    appliesTo: { complaints: ["kidney_stone_pain", "gravel_in_urine_baul_e_ramli", "blood_in_urine_baul_ud_dam", "bloody_urine_from_kidneys_renal_bleeding_qulj", "back_pain", "abdominal_pain", "difficulty_urinating_dysuria_usr_ul_baul"] },
    signs: [
      S("Colicky loin pain to the groin", { complaints: ["kidney_stone_pain"], regions: ["Loin", "Flank", "Kidney"], text: ["loin", "flank", "groin"] }, 4),
      S("Blood or gravel in urine", { complaints: ["blood_in_urine_baul_ud_dam", "gravel_in_urine_baul_e_ramli"], exam: [ex("baul", "Reddish / sandy"), ex("baul", "Yes, visible blood")] }, 3),
      S("Known kidney stones", { conditions: ["kidney_stones"] }, 3),
    ],
    dontMiss: [SEPSIS_KIDNEY, { label: "Aortic aneurysm", why: "Over 60 with sudden back or loin pain and faintness." }], investigations: ["Urine routine", "Ultrasound kidneys", "Kidney function"],
  },
  {
    key: "waram_e_masana", label: "Waram-e-Masana / Hurqat-ul-Baul (Cystitis, urinary infection)", localName: "ورمِ مثانہ / حرقۃ البول", category: "Amraz-e-Kulya-o-Masana (urinary)", icd: "N30",
    description: "Burning, frequent urination from hot, sharp matter or infection in the bladder.",
    organs: ["Masana"], mizaj: ["Haar", "Safrawi"], type: "Maddi", sabab: ["Infection", "Too little water", "Hot, spicy food", "Holding urine"],
    appliesTo: { complaints: ["burning_urination", "frequent_urination", "bladder_inflammation_cystitis_waram_e_masana", "difficulty_urinating_dysuria_usr_ul_baul", "foul_smelling_urine_nutn_ul_baul", "turbid_cloudy_urine_baul_e_kadir", "pus_in_urine_pyuria_baul_e_sa_deedi"] },
    signs: [
      S("Burning on passing urine", { complaints: ["burning_urination", "bladder_inflammation_cystitis_waram_e_masana"], exam: [ex("baul", "Marked burning"), ex("baul", "Mild", "Burning")] }, 4),
      S("Frequent urination", { complaints: ["frequent_urination", "drop_by_drop_urination_strangury_taqteer_ul_baul"] }, 2),
      S("Cloudy or foul urine", { exam: [ex("baul", "Ghaleez"), ex("baul", "Foul")], complaints: ["foul_smelling_urine_nutn_ul_baul", "turbid_cloudy_urine_baul_e_kadir"] }, 2),
      S("Deep yellow urine", { exam: [ex("baul", "Asfar / Nari")] }),
    ],
    dontMiss: [SEPSIS_KIDNEY, PREGNANCY], investigations: ["Urine routine and culture", "Pregnancy test if relevant"],
  },
  {
    key: "ziabetus", label: "Ziabetus (Diabetes)", localName: "ذیابیطس", category: "Amraz-e-Kulya-o-Masana (urinary)", icd: "E11",
    description: "Excess urination and thirst with weight change; classically weakness of the kidneys' retaining power.",
    organs: ["Kulya", "Kabid"], mizaj: ["Haar", "Yabis"], type: "Sada", sabab: ["Heat and weakness of the kidneys (classical)", "Excess sweet and rich food", "Inactivity", "Family history"],
    appliesTo: { complaints: ["excessive_thirst_with_polyuria_ziyabatus", "excessive_thirst", "frequent_urination", "weight_loss_emaciation_huzal", "fatigue_exhaustion_i_ya", "numbness_tingling_khadar"] },
    signs: [
      S("Thirst and frequent urination", { complaints: ["excessive_thirst_with_polyuria_ziyabatus", "excessive_thirst", "frequent_urination"] }, 3),
      S("Copious urine", { exam: [ex("baul", "Kaseer")] }, 2),
      S("Known diabetes", { conditions: ["diabetes"] }, 4),
      S("Weight loss or tiredness", { complaints: ["weight_loss_emaciation_huzal", "fatigue_exhaustion_i_ya"] }),
    ],
    dontMiss: [{ label: "Very high sugar (ketoacidosis)", why: "Vomiting, abdominal pain, fast breathing or drowsiness with high sugar." }], investigations: ["Fasting blood sugar and HbA1c", "Urine sugar"],
  },
  // ---------------------------------------------------------------- General, heart & blood
  {
    key: "humma", label: "Humma (Fever)", localName: "حمیٰ", category: "Humiyat (fevers)", icd: "R50",
    description: "Fever — Humma-e-Yaumiya (one-day), putrefactive (Ufoonati) or hectic (Diqq) by course.",
    organs: ["Qalb"], mizaj: ["Haar"], type: "Maddi", sabab: ["Infection", "Putrefaction of humours", "Heat and exhaustion"],
    appliesTo: { complaints: ["fever", "chills_rigors_qusha_reera", "intermittent_fever_humma_e_nawbiya", "hectic_fever_consumption_humma_e_diqq", "general_body_ache_malaise_tamaddud", "excessive_thirst_with_fever_atash_e_mufrit"] },
    signs: [
      S("Raised temperature", { vitals: ["fever", "fever_high"], complaints: ["fever"] }, 4),
      S("Fast, full pulse", { exam: [ex("nabz", "Fast and full"), ex("nabz", "Saree'")] }, 2),
      S("Chills or rigors", { complaints: ["chills_rigors_qusha_reera", "intermittent_fever_humma_e_nawbiya"] }),
    ],
    dontMiss: [MENINGITIS, { label: "Malaria, dengue or typhoid", why: "Fever over 3 days, rigors, rash, bleeding or abdominal pain — test before treating." }, { label: "Sepsis", why: "Fever with confusion, low BP or very fast pulse." }], investigations: ["Blood count", "Malaria test", "Dengue test if rash or low platelets", "Typhoid test if fever over 5 days"],
  },
  {
    key: "faqr_ud_dam", label: "Faqr-ud-Dam / Qillat-ud-Dam (Anaemia)", localName: "فقر الدم", category: "Amraz-e-Dam (blood)", icd: "D64.9",
    description: "Too little or poor-quality blood: pallor, tiredness, breathlessness on effort.",
    organs: ["Kabid", "Tihal"], mizaj: ["Barid", "Balghami"], type: "Sada", sabab: ["Poor diet", "Blood loss (heavy periods, piles, worms)", "Weak liver (classical)"],
    appliesTo: { complaints: ["anemia_faqr_ud_dam", "general_weakness", "fatigue_exhaustion_i_ya", "dizziness_vertigo_dawar", "palpitations", "excessive_menstrual_bleeding_kasrat_e_tams", "craving_for_non_food_items_pica_gil_khori"] },
    signs: [
      S("Pallor of nails and inner eyelids", { exam: [ex("zahiri", "Marked pallor"), ex("zahiri", "Pale", "Nails"), ex("lisan", "Pale / whitish")] }, 4),
      S("Pale complexion", { exam: [ex("zahiri", "Pale, white")] }, 2),
      S("Weakness or tiredness", { complaints: ["general_weakness", "fatigue_exhaustion_i_ya"] }),
      S("Fast pulse", { vitals: ["pulse_fast"] }),
      S("Heavy periods or blood loss", { complaints: ["excessive_menstrual_bleeding_kasrat_e_tams", "piles", "blood_in_stool_zahir_ud_dam"] }),
    ],
    dontMiss: [GI_BLEED, CANCER_BOWEL], investigations: ["Haemoglobin and blood count", "Iron studies", "Stool for occult blood if over 45"],
  },
  {
    key: "saman_e_mufrit", label: "Saman-e-Mufrit (Obesity)", localName: "سمنِ مفرط", category: "Amraz-e-Aam (general)", icd: "E66",
    description: "Excess body fat, attributed to a cold, moist temperament and excess food.",
    organs: [], mizaj: ["Balghami", "Barid", "Ratab"], type: "Sada", sabab: ["Excess food and sweets", "Inactivity", "Excess sleep", "Underactive thyroid"],
    appliesTo: { complaints: ["obesity_overweight_saman_e_mufrit", "fatigue_exhaustion_i_ya", "lethargy_sluggishness_kasal", "excessive_sleepiness_kasrat_e_naum"] },
    signs: [
      S("Overweight", { complaints: ["obesity_overweight_saman_e_mufrit"], conditions: ["obesity"] }, 4),
      S("Plump, soft build", { exam: [ex("zahiri", "Plump, soft")] }, 3),
      S("Cool, moist skin", { exam: [ex("zahiri", "Cool and moist")] }),
    ],
    dontMiss: [{ label: "Underactive thyroid", why: "Weight gain with tiredness, constipation and cold intolerance." }, { label: "Diabetes and high blood pressure", why: "Common with excess weight — check both." }], investigations: ["Blood sugar", "Lipids", "Thyroid test"],
  },
  {
    key: "zaght_ud_dam_qawi", label: "Zaght-ud-Dam Qawi (High blood pressure)", localName: "ضغط الدم قوی", category: "Amraz-e-Qalb (heart)", icd: "I10",
    description: "Raised blood pressure, often without symptoms; classically linked with excess blood (Damawi) and heat.",
    organs: ["Qalb"], mizaj: ["Damawi", "Haar"], type: "Maddi", sabab: ["Excess salt and rich food", "Stress", "Excess weight", "Family history"],
    appliesTo: { complaints: ["headache", "dizziness_vertigo_dawar", "heaviness_in_head_siqal_e_ra_s", "palpitations", "nosebleed_ru_af"] },
    signs: [
      S("Raised blood pressure today", { vitals: ["bp_high", "bp_very_high"] }, 5),
      S("Known high blood pressure", { conditions: ["hypertension"] }, 4),
      S("Full, hard pulse", { exam: [ex("nabz", "Mumtali"), ex("nabz", "Sulb")] }),
      S("Red, flushed face", { exam: [ex("zahiri", "Red, flushed"), ex("zahiri", "Reddish, ruddy")] }),
    ],
    dontMiss: [{ label: "Hypertensive emergency", why: "BP 180/110 or more with headache, chest pain, breathlessness, confusion or vision change." }, STROKE], investigations: ["Repeat BP on two visits", "Kidney function", "Urine protein", "ECG"],
  },
  {
    key: "khafqan", label: "Khafqan (Palpitations)", localName: "خفقان", category: "Amraz-e-Qalb (heart)", icd: "R00.2",
    description: "Awareness of a fast, strong or irregular heartbeat.",
    organs: ["Qalb"], mizaj: ["Haar", "Saudawi"], type: "Sada", sabab: ["Anxiety and fear", "Heat", "Anaemia", "Tea, coffee, tobacco"],
    appliesTo: { complaints: ["palpitations", "anxiety_stress", "heart_weakness_zo_f_e_qalb", "chest_pain", "fainting_syncope_ghashi"] },
    signs: [
      S("Palpitations", { complaints: ["palpitations"] }, 3),
      S("Fast pulse", { vitals: ["pulse_fast", "pulse_very_fast"], exam: [ex("nabz", "Saree'")] }, 2),
      S("Irregular pulse", { exam: [ex("nabz", "Mukhtalif"), ex("nabz", "Ghair Muntazim")] }, 3),
    ],
    dontMiss: [{ label: "Heart rhythm disorder", why: "Irregular pulse, fainting, chest pain or breathlessness — needs an ECG." }, { label: "Overactive thyroid", why: "Weight loss, tremor, heat intolerance." }, { label: "Anaemia", why: "Pallor and tiredness." }], investigations: ["ECG", "Thyroid test", "Haemoglobin"],
  },
  // ---------------------------------------------------------------- Women's health
  {
    key: "usr_e_tams", label: "Usr-e-Tams (Painful periods)", localName: "عسرِ طمث", category: "Amraz-e-Niswan (women's health)", icd: "N94.6",
    description: "Painful menstruation, often from cold or thick matter obstructing the flow.",
    organs: ["Rahim"], mizaj: ["Barid", "Balghami", "Saudawi"], type: "Maddi", sabab: ["Cold temperament of the uterus", "Thick blood", "Stress"],
    appliesTo: { complaints: ["painful_menstruation_dysmenorrhea_usr_e_tams", "pelvic_uterine_pain_waja_ur_rahem", "menstrual_problem", "back_pain"] },
    signs: [
      S("Pain with periods", { complaints: ["painful_menstruation_dysmenorrhea_usr_e_tams"] }, 4),
      S("Better with warmth", { better: ["warm", "hot"] }, 2),
      S("Female", { sex: "female" }, 1),
    ],
    dontMiss: [{ label: "Endometriosis or pelvic infection", why: "Pain getting worse over years, pain between periods, fever or discharge." }, { label: "Ectopic pregnancy", why: "Missed period with one-sided lower abdominal pain or faintness — emergency." }], investigations: ["Ultrasound pelvis if severe or new"],
  },
  {
    key: "ehtebas_e_tams", label: "Ehtebas-e-Tams (Absent periods)", localName: "احتباسِ طمث", category: "Amraz-e-Niswan (women's health)", icd: "N91",
    description: "Absent or delayed periods, classically from cold, thick matter obstructing the flow.",
    organs: ["Rahim"], mizaj: ["Barid", "Balghami", "Saudawi"], type: "Maddi", sabab: ["Cold, thick matter", "Weight gain (PCOS)", "Stress or weight loss", "Thyroid disorder"],
    appliesTo: { complaints: ["absence_of_menstruation_ehtebas_e_tams", "scanty_menstruation_qillat_e_tams", "menstrual_problem", "excessive_facial_hair_hirsutism_kasrat_e_sha_ar", "infertility_concern"] },
    signs: [
      S("Absent or delayed periods", { complaints: ["absence_of_menstruation_ehtebas_e_tams", "scanty_menstruation_qillat_e_tams"] }, 4),
      S("Excess facial hair or weight gain", { complaints: ["excessive_facial_hair_hirsutism_kasrat_e_sha_ar", "obesity_overweight_saman_e_mufrit"], conditions: ["pcos", "obesity"] }, 2),
      S("Female", { sex: "female" }, 1),
    ],
    dontMiss: [PREGNANCY, { label: "Thyroid or prolactin disorder", why: "Milky nipple discharge, weight change, tiredness." }], investigations: ["Pregnancy test", "Thyroid and prolactin", "Ultrasound pelvis (PCOS)"],
  },
  {
    key: "kasrat_e_tams", label: "Kasrat-e-Tams (Heavy periods)", localName: "کثرتِ طمث", category: "Amraz-e-Niswan (women's health)", icd: "N92",
    description: "Heavy or prolonged menstrual bleeding, classically from hot, thin blood (Damawi / Safrawi).",
    organs: ["Rahim"], mizaj: ["Damawi", "Safrawi", "Haar"], type: "Maddi", sabab: ["Hot, thin blood", "Fibroids", "Hormonal imbalance"],
    appliesTo: { complaints: ["excessive_menstrual_bleeding_kasrat_e_tams", "irregular_vaginal_bleeding_istehaza", "menstrual_problem", "anemia_faqr_ud_dam"] },
    signs: [
      S("Heavy or long periods", { complaints: ["excessive_menstrual_bleeding_kasrat_e_tams"] }, 4),
      S("Bleeding between periods", { complaints: ["irregular_vaginal_bleeding_istehaza"] }, 2),
      S("Pallor", { exam: [ex("zahiri", "Marked pallor"), ex("zahiri", "Pale, white")] }),
    ],
    dontMiss: [{ label: "Anaemia", why: "Pallor, tiredness, breathlessness." }, { label: "Uterine growth or cancer", why: "Bleeding after menopause or between periods over 40." }, PREGNANCY], investigations: ["Haemoglobin", "Ultrasound pelvis", "Thyroid test"],
  },
  {
    key: "sayalan_ur_rahem", label: "Sayalan-ur-Rahem (Leucorrhoea)", localName: "سیلان الرحم", category: "Amraz-e-Niswan (women's health)", icd: "N89.8",
    description: "White vaginal discharge, classically from cold, moist (Balghami) matter.",
    organs: ["Rahim"], mizaj: ["Balghami", "Ratab", "Barid"], type: "Maddi", sabab: ["Balghami matter", "Weakness", "Infection"],
    appliesTo: { complaints: ["leucorrhea", "vaginal_itching_hikka_e_farj", "back_pain", "general_weakness"] },
    signs: [
      S("White discharge", { complaints: ["leucorrhea"] }, 4),
      S("Itching", { complaints: ["vaginal_itching_hikka_e_farj"] }, 2),
      S("Female", { sex: "female" }, 1),
    ],
    dontMiss: [{ label: "Pelvic or sexually transmitted infection", why: "Coloured or foul discharge, pelvic pain or fever." }, { label: "Diabetes", why: "Recurrent thrush." }], investigations: ["Vaginal swab if coloured or foul", "Blood sugar if recurrent"],
  },
  // ---------------------------------------------------------------- Eye, ear, mouth
  {
    key: "ramad", label: "Ramad (Conjunctivitis)", localName: "رمد", category: "Amraz-e-Ayn (eye)", icd: "H10",
    description: "Red, inflamed eyes with watering or sticky discharge.",
    organs: ["Ayn"], mizaj: ["Damawi", "Haar"], type: "Maddi", sabab: ["Infection", "Hot matter rising to the eyes", "Dust and allergy"],
    appliesTo: { complaints: ["eye_redness_conjunctivitis_rammad", "watery_eyes_epiphora_dama_a", "burning_in_eyes_hurqat_ul_ain", "eye_problem"] },
    signs: [
      S("Red, congested eyes", { exam: [ex("ayn", "Red, congested")], complaints: ["eye_redness_conjunctivitis_rammad"] }, 4),
      S("Watery or sticky discharge", { exam: [ex("ayn", "Watery"), ex("ayn", "Sticky, yellow")] }, 2),
    ],
    dontMiss: [{ label: "Acute glaucoma or deep eye inflammation", why: "Painful red eye with blurred vision, halos or headache — same-day eye referral." }], investigations: [],
  },
  {
    key: "waja_ul_uzn", label: "Waja-ul-Uzn (Ear infection)", localName: "وجع الاذن", category: "Amraz-e-Uzn (ear)", icd: "H66",
    description: "Ear pain, sometimes with discharge and fever.",
    organs: ["Uzn"], mizaj: ["Haar", "Damawi"], type: "Maddi", sabab: ["Infection after a cold", "Water in the ear", "Hot matter"],
    appliesTo: { complaints: ["earache_waja_ul_uzn", "ear_discharge_sayalan_ul_uzn", "ear_problem", "hearing_impairment_hard_of_hearing_siqal_e_sama_at"] },
    signs: [
      S("Ear pain", { complaints: ["earache_waja_ul_uzn"] }, 3),
      S("Ear discharge", { complaints: ["ear_discharge_sayalan_ul_uzn"] }, 3),
      S("Fever", { vitals: ["fever", "fever_high"] }),
    ],
    dontMiss: [{ label: "Mastoiditis", why: "Swelling and tenderness behind the ear with fever." }], investigations: ["Ear examination with otoscope"],
  },
  {
    key: "qula", label: "Qula' (Mouth ulcers)", localName: "قلاع", category: "Amraz-e-Fam (mouth)", icd: "K12",
    description: "Painful ulcers in the mouth, from hot, sharp matter or weak digestion.",
    organs: ["Halq", "Meda"], mizaj: ["Safrawi", "Haar"], type: "Maddi", sabab: ["Heat of the stomach", "Spicy food", "Stress", "Vitamin deficiency"],
    appliesTo: { complaints: ["mouth_ulcers_qula", "tongue_swelling_glossitis_waram_e_lisan", "bad_breath_bakhr_ul_fam"] },
    signs: [
      S("Painful mouth ulcers", { complaints: ["mouth_ulcers_qula"], exam: [ex("lisan", "Multiple, painful, red-edged")] }, 4),
      S("Red tongue", { exam: [ex("lisan", "Red, bright")] }),
      S("Worse with spicy food", { worse: ["spic", "hot", "sour"] }),
    ],
    dontMiss: [{ label: "Mouth cancer", why: "A single ulcer lasting more than 3 weeks, especially in a smoker or tobacco chewer." }], investigations: ["Biopsy if an ulcer lasts over 3 weeks"],
  },
];
