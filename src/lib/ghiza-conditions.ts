// Health conditions the diet engine recognises in a patient's recorded
// history (chronic conditions, medical history, current medicines, complaints)
// — free text, so each condition has a pattern covering common English and
// local terms. Food rules refer to these keys.

export const CONDITIONS = [
  { key: "diabetes", label: "Diabetes / high sugar", match: /diabet|madhumeh|ziabetus|ziyabitus|blood sugar|high sugar|pre-?diabet|metformin|insulin|glimepiride|hba1c/i },
  { key: "hypertension", label: "High blood pressure", match: /hypertens|high (blood )?pressure|high bp|\bbp\b|amlodipine|telmisartan|losartan|zaght-ud-dam/i },
  { key: "cholesterol", label: "High cholesterol / lipids", match: /cholesterol|lipid|dyslipid|hyperlipid|statin|triglycer/i },
  { key: "obesity", label: "Overweight / obesity", match: /obes|overweight|weight gain|siman|fatty build/i },
  { key: "heart", label: "Heart disease", match: /heart disease|cardiac|angina|coronary|heart attack|myocard|heart failure|palpitation/i },
  { key: "kidney_stones", label: "Kidney stones", match: /kidney stone|renal (stone|calcul)|hasat|pathri|nephrolith/i },
  { key: "kidney", label: "Kidney disease", match: /kidney disease|renal (failure|disease|insufficien)|ckd|dialysis/i },
  { key: "gout", label: "Gout / high uric acid", match: /gout|uric acid|niqris|hyperuric/i },
  { key: "acidity", label: "Acidity / reflux / ulcer", match: /acidity|gerd|reflux|heartburn|peptic|gastritis|ulcer|hyperacid|hurqat-e-meda|sozish/i },
  { key: "ibs", label: "Bowel sensitivity (IBS / colitis)", match: /\bibs\b|irritable bowel|colitis|crohn/i },
  { key: "constipation", label: "Chronic constipation", match: /constipat|qabz/i },
  { key: "liver", label: "Liver disease / fatty liver", match: /liver|hepat|fatty liver|jaundice|yarqan|cirrhos/i },
  { key: "anaemia", label: "Anaemia", match: /anaemi|anemi|low (hb|haemoglobin|hemoglobin)|qillat-ud-dam|iron deficien/i },
  { key: "thyroid_low", label: "Underactive thyroid", match: /hypothyro|thyroxine|levothyrox|low thyroid/i },
  { key: "asthma", label: "Asthma / chronic cough", match: /asthma|copd|bronchit|chronic cough|zeeq-un-nafas|rabv/i },
  { key: "arthritis", label: "Arthritis / joint disease", match: /arthrit|osteoarth|rheumat|joint pain|waja-ul-mafasil/i },
  { key: "migraine", label: "Migraine / chronic headache", match: /migraine|shaqeeqa|chronic headache/i },
  { key: "piles", label: "Piles", match: /piles|haemorrhoid|hemorrhoid|bawaseer/i },
  { key: "skin", label: "Chronic skin disease", match: /eczema|psoria|dermatit|urticaria|vitiligo|bars|acne/i },
  { key: "pcos", label: "PCOS / hormonal", match: /pcos|pcod|polycystic/i },
] as const;
export type ConditionKey = (typeof CONDITIONS)[number]["key"];

/** Condition keys found in free-text history. */
export function conditionsIn(text: string): ConditionKey[] {
  return CONDITIONS.filter((c) => c.match.test(text)).map((c) => c.key);
}
export const conditionLabel = (k: string) => CONDITIONS.find((c) => c.key === k)?.label ?? k;
