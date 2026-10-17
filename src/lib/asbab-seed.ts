import { db } from "@/lib/db";

// Starter Asbab-e-Sittah question bank. A clinical STARTING POINT for the
// Unani team to review in Admin → Meta → Asbab-e-Sittah — every question,
// option and humoral weight there is editable, and can be disabled.
//
// Weighting follows the classical correspondences: Safra = hot & dry,
// Dam = hot & moist, Balgham = cold & moist, Sauda = cold & dry. Seasons use
// the classical scheme (Rabi' → Dam, Sayf → Safra, Kharif → Sauda,
// Shita → Balgham); a balanced (Mo'tadil) answer carries no points.

type O = { label: string; description?: string; safra?: number; dam?: number; balgham?: number; sauda?: number };
type Q = { label: string; labelLocal?: string; helpText?: string; type: "single_select" | "multi_select" | "numeric" | "text"; required?: boolean; weight?: number; options?: O[] };

const PILLARS: { key: string; label: string; english: string; description: string; questions: Q[] }[] = [
  {
    key: "hawa", label: "Hawa-e-Muheet", english: "Ambient Air & Environment",
    description: "The air, seasons and surroundings the patient lives and works in — their effect on the body's heat, moisture and the Akhlat.",
    questions: [
      { label: "In which season are the complaints worst?", labelLocal: "Mausam ka asar", type: "single_select", required: true, weight: 1.2, options: [
        { label: "Sayf (Summer)", description: "Heat aggravates the complaints", safra: 2 },
        { label: "Shita (Winter)", description: "Cold and damp aggravate the complaints", balgham: 2 },
        { label: "Kharif (Autumn)", description: "Dry, cooling weather aggravates the complaints", sauda: 2 },
        { label: "Rabi' (Spring)", description: "Warm, moist spring weather aggravates the complaints", dam: 2 },
        { label: "No seasonal pattern", description: "Mo'tadil — complaints do not vary with the season" },
      ] },
      { label: "Which weather is hardest to tolerate?", type: "single_select", weight: 1, options: [
        { label: "Hot, sunny weather", description: "Feels burning, irritable, thirsty in heat", safra: 2 },
        { label: "Cold, damp weather", description: "Feels heavy, congested, sluggish", balgham: 2 },
        { label: "Cold, dry wind", description: "Skin and joints feel dry and stiff", sauda: 2 },
        { label: "Warm, humid weather", description: "Feels flushed, heavy-headed, sweaty", dam: 2 },
        { label: "Tolerates all weather well", description: "Mo'tadil" },
      ] },
      { label: "What is the air like where the patient lives and works most of the day?", type: "single_select", weight: 1, options: [
        { label: "Hot, sun-exposed or near heat sources", description: "Kitchens, furnaces, outdoor work in sun", safra: 2 },
        { label: "Damp, poorly ventilated or near water", balgham: 2 },
        { label: "Dry, dusty or long hours in air-conditioning", sauda: 2 },
        { label: "Crowded, warm and humid", dam: 2 },
        { label: "Open, well-ventilated and temperate", description: "Mo'tadil" },
      ] },
      { label: "Regular exposure to any of these?", helpText: "Select all that apply", type: "multi_select", weight: 0.6, options: [
        { label: "Smoke or tobacco smoke", safra: 1, sauda: 1 },
        { label: "Dust or industrial particulates", sauda: 1 },
        { label: "Vehicle or city pollution", safra: 1 },
        { label: "Strong chemical odours or fumes", safra: 1 },
        { label: "Mould or damp walls", balgham: 1 },
        { label: "None of these" },
      ] },
    ],
  },
  {
    key: "makool", label: "Makool-o-Mashroob", english: "Food & Drink",
    description: "Diet, drinks, appetite and digestion — what is taken in and how the Quwwat-e-Hazima (digestive faculty) handles it.",
    questions: [
      { label: "How does digestion react after heavy, spiced or fried meals?", labelLocal: "Hazm", type: "single_select", required: true, weight: 1.4, options: [
        { label: "Burning and acidity within 30 minutes (Sozish-e-Meda)", description: "Bitter belching, gastric heat, urge for cold drinks", safra: 2 },
        { label: "Heaviness, cold bloating and slow emptying", description: "Lethargy, thick saliva, no appetite until the next day", balgham: 2 },
        { label: "Wind, dry colicky cramps and irregular stools", description: "Variable digestion, hard or dark stools", sauda: 2 },
        { label: "Quick digestion with early, recurring hunger", description: "Comfortable, warm digestion", dam: 2 },
      ] },
      { label: "How strong is the thirst (Atash)?", type: "single_select", weight: 1.2, options: [
        { label: "Intense thirst, prefers cold drinks", safra: 2 },
        { label: "Rarely thirsty", balgham: 2 },
        { label: "Dry mouth and throat, moderate thirst", sauda: 2 },
        { label: "Normal thirst, prefers warm drinks", dam: 1 },
      ] },
      { label: "What does the usual diet mostly consist of?", type: "single_select", weight: 1, options: [
        { label: "Spicy, fried, sour or salty food", description: "Hot (Haar) dietary pattern", safra: 2 },
        { label: "Cold, raw food, dairy, rice and sweets", description: "Cold and moist (Barid-Ratab) pattern", balgham: 2 },
        { label: "Dry, stale or preserved food, pulses, brinjal", description: "Cold and dry (Barid-Yabis) pattern", sauda: 2 },
        { label: "Rich food, red meat, ghee and sweets", description: "Hot and moist (Haar-Ratab) pattern", dam: 2 },
        { label: "Balanced, varied home food", description: "Mo'tadil" },
      ] },
      { label: "How is the appetite (Ishtiha)?", type: "single_select", weight: 1, options: [
        { label: "Sharp — becomes irritable or weak if a meal is late", safra: 2 },
        { label: "Low or sluggish appetite", balgham: 2 },
        { label: "Variable, with cravings for sour or dry food", sauda: 2 },
        { label: "Good, steady appetite", dam: 1 },
      ] },
      { label: "Meal timing", helpText: "Select all that apply", type: "multi_select", weight: 0.6, options: [
        { label: "Regular meals at fixed times" },
        { label: "Often skips meals or fasts long hours", safra: 1, sauda: 1 },
        { label: "Frequent snacking or overeating", balgham: 1, dam: 1 },
        { label: "Late-night dinners", balgham: 1 },
      ] },
      { label: "Approximate water intake per day (litres)", type: "numeric", weight: 0 },
    ],
  },
  {
    key: "harkat_badani", label: "Harkat-o-Sukoon-e-Badani", english: "Physical Movement & Rest",
    description: "Bodily activity, exercise (Riyazat) and rest — movement kindles the innate heat, while excess rest lets moisture and phlegm accumulate.",
    questions: [
      { label: "How physically active is the patient day to day?", type: "single_select", required: true, weight: 1.2, options: [
        { label: "Very active or strenuous — overheats easily", safra: 2 },
        { label: "Mostly sedentary — sits most of the day", balgham: 2 },
        { label: "Irregular activity — tires quickly with stiffness", sauda: 2 },
        { label: "Moderate, regular activity", description: "Mo'tadil" },
      ] },
      { label: "How often does the patient exercise (Riyazat)?", type: "single_select", weight: 0.8, options: [
        { label: "Daily" },
        { label: "A few times a week" },
        { label: "Rarely", balgham: 1 },
        { label: "Never", balgham: 1, sauda: 1 },
      ] },
      { label: "How does the body respond to exertion?", type: "single_select", weight: 1, options: [
        { label: "Heat, flushing and irritability", safra: 2 },
        { label: "Breathless and heavy, cold sweat", balgham: 2 },
        { label: "Muscle stiffness, cramps or dryness", sauda: 2 },
        { label: "Feels energised and warm", dam: 1 },
      ] },
      { label: "What are the physical demands of the patient's work?", type: "single_select", weight: 0.8, options: [
        { label: "Desk-bound for long hours", balgham: 1, sauda: 1 },
        { label: "Standing or heavy manual labour", safra: 1 },
        { label: "Mixed sitting and moving" },
      ] },
    ],
  },
  {
    key: "harkat_nafsani", label: "Harkat-o-Sukoon-e-Nafsani", english: "Psychological Activity & Rest",
    description: "Emotions and mental states (A'raz-e-Nafsaniya) — anger, grief, fear and joy each move the innate heat and the Akhlat in their own way.",
    questions: [
      { label: "What is the patient's usual emotional temperament?", type: "single_select", required: true, weight: 1.4, options: [
        { label: "Quick to anger and irritability (Ghazab)", safra: 2 },
        { label: "Calm and slow to react, sometimes dull", balgham: 2 },
        { label: "Prone to worry, sadness and overthinking (Ghamm, Fikr)", sauda: 2 },
        { label: "Cheerful, sociable and optimistic (Farah)", dam: 2 },
      ] },
      { label: "Current level of stress", type: "single_select", weight: 1, options: [
        { label: "Low" },
        { label: "Moderate", sauda: 1 },
        { label: "High", safra: 1, sauda: 1 },
        { label: "Severe — affecting sleep or appetite", safra: 2, sauda: 2 },
      ] },
      { label: "How is the patient's mental activity and focus?", type: "single_select", weight: 1, options: [
        { label: "Sharp but restless — the mind races", safra: 2 },
        { label: "Slow, foggy or drowsy", balgham: 2 },
        { label: "Anxious, fearful or ruminating", sauda: 2 },
        { label: "Focused and steady", dam: 1 },
      ] },
      { label: "Recent major emotional events", helpText: "Select all that apply", type: "multi_select", weight: 0.8, options: [
        { label: "Grief or loss (Huzn)", sauda: 2 },
        { label: "Conflict or anger", safra: 2 },
        { label: "Fear or shock (Khauf)", sauda: 1, balgham: 1 },
        { label: "Excessive excitement or joy", dam: 1 },
        { label: "None" },
      ] },
    ],
  },
  {
    key: "naum", label: "Naum-o-Yaqza", english: "Sleep & Wakefulness",
    description: "Sleep draws the innate heat inward and aids digestion; wakefulness disperses it — their balance protects the Akhlat.",
    questions: [
      { label: "Average hours of sleep per night", type: "numeric", required: true, weight: 0 },
      { label: "How is the quality of sleep?", type: "single_select", required: true, weight: 1.2, options: [
        { label: "Light and disturbed — wakes feeling hot", safra: 2 },
        { label: "Deep and excessive — hard to wake, groggy", balgham: 2 },
        { label: "Difficulty falling asleep, worrying, insomnia (Sahar)", sauda: 2 },
        { label: "Sound and refreshing", dam: 1 },
      ] },
      { label: "Sleep timing", helpText: "Select all that apply", type: "multi_select", weight: 0.8, options: [
        { label: "Sleeps before 11 pm" },
        { label: "Sleeps after midnight", safra: 1, sauda: 1 },
        { label: "Habitual daytime sleep", balgham: 1 },
        { label: "Night shifts or irregular hours", safra: 1, sauda: 1 },
      ] },
      { label: "What kind of dreams are common?", helpText: "Classical humoral dream signs", type: "single_select", weight: 0.8, options: [
        { label: "Fire, heat, yellow colours or quarrels", safra: 2 },
        { label: "Water, rain, snow or heaviness", balgham: 2 },
        { label: "Darkness, fear or frightening scenes", sauda: 2 },
        { label: "Pleasant, colourful or red scenes", dam: 2 },
        { label: "Rarely remembers dreams" },
      ] },
    ],
  },
  {
    key: "ihtibas", label: "Ihtibas-o-Istifragh", english: "Retention & Evacuation",
    description: "Retention and elimination of bodily wastes — stools, urine and sweat — and whether they are excessive, deficient or altered.",
    questions: [
      { label: "What is the usual bowel habit?", type: "single_select", required: true, weight: 1.4, options: [
        { label: "Loose, frequent or burning stools", safra: 2 },
        { label: "Sluggish, with mucus", balgham: 2 },
        { label: "Constipated, hard and dry stools (Qabz)", sauda: 2 },
        { label: "Regular, once a day", description: "Mo'tadil" },
      ] },
      { label: "How is the urine?", type: "single_select", weight: 1.2, options: [
        { label: "Scanty, deep yellow, with burning", safra: 2 },
        { label: "Copious, pale or turbid", balgham: 2 },
        { label: "Dark or greyish and scanty", sauda: 2 },
        { label: "Normal, light straw-coloured", description: "Mo'tadil" },
      ] },
      { label: "How is the perspiration (Araq)?", type: "single_select", weight: 1, options: [
        { label: "Profuse and warm", safra: 1, dam: 1 },
        { label: "Profuse, cold and clammy", balgham: 2 },
        { label: "Scanty — skin stays dry", sauda: 2 },
        { label: "Normal" },
      ] },
      { label: "Any of these other evacuation changes?", helpText: "Select all that apply", type: "multi_select", weight: 0.8, options: [
        { label: "Excess phlegm or frequent spitting", balgham: 2 },
        { label: "Frequent nasal discharge", balgham: 1 },
        { label: "Easy bleeding (nose, gums, piles)", dam: 1, safra: 1 },
        { label: "Excessive flatulence", sauda: 1 },
        { label: "None" },
      ] },
    ],
  },
];

/** Seeds the six pillars always (missing ones only) and the starter questions once, if none exist. */
export async function seedAsbabConfig() {
  for (const [i, p] of PILLARS.entries()) {
    await db.asbabPillar.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, label: p.label, english: p.english, description: p.description, sortOrder: i },
    });
  }
  const marker = await db.portalSetting.findUnique({ where: { category_key: { category: "seed_versions", key: "asbab" } } });
  if (marker || (await db.asbabQuestion.count())) return;

  for (const p of PILLARS) {
    const pillar = await db.asbabPillar.findUnique({ where: { key: p.key } });
    if (!pillar) continue;
    for (const [qi, q] of p.questions.entries()) {
      await db.asbabQuestion.create({
        data: {
          pillarId: pillar.id, label: q.label, labelLocal: q.labelLocal ?? null, helpText: q.helpText ?? null,
          type: q.type, required: !!q.required, weight: q.weight ?? 1, sortOrder: qi,
          options: { create: (q.options || []).map((o, oi) => ({ label: o.label, description: o.description ?? null, safra: o.safra ?? 0, dam: o.dam ?? 0, balgham: o.balgham ?? 0, sauda: o.sauda ?? 0, sortOrder: oi })) },
        },
      });
    }
  }
  await db.portalSetting.create({ data: { category: "seed_versions", key: "asbab", value: "1" } });
}
