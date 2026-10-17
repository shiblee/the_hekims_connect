import { db } from "@/lib/db";

// Starter content for Stage 5 (Tashkhees & Handover Dossier). A clinical
// STARTING POINT for the Unani team — every item is editable or can be
// disabled in Admin → Meta → Tashkhees & Ilaj. Humoral points follow the
// classical sign correspondences (Safra hot-dry, Dam hot-moist, Balgham
// cold-moist, Sauda cold-dry); a normal (Mo'tadil) finding carries none.

type O = { label: string; description?: string; safra?: number; dam?: number; balgham?: number; sauda?: number };
type Q = { label: string; labelLocal?: string; type?: "single_select" | "multi_select" | "text"; required?: boolean; weight?: number; options?: O[] };

const MOTADIL = "Mu'tadil (normal)";

const DALAIL: { key: string; label: string; english: string; description: string; questions: Q[] }[] = [
  {
    key: "nabz", label: "Nabz (Ajnas-e-Ashrah)", english: "Pulse — the ten classical parameters",
    description: "Palpate the radial pulse and record each of the ten Ajnas (parameters) described by Ibn Sina.",
    questions: [
      { label: "Miqdar (Magnitude)", labelLocal: "Size of the expansion", required: true, options: [
        { label: "Azeem (Large)", dam: 1.5, safra: 0.5 }, { label: "Sagheer (Small)", balgham: 1, sauda: 1 }, { label: MOTADIL } ] },
      { label: "Quwwat (Strength)", labelLocal: "Force of the beat", required: true, options: [
        { label: "Qawi (Strong)", dam: 1.5, safra: 1 }, { label: "Za'eef (Weak)", balgham: 1.5, sauda: 1 }, { label: MOTADIL } ] },
      { label: "Zaman-e-Harkat (Speed)", labelLocal: "Speed of each movement", required: true, weight: 1.2, options: [
        { label: "Saree' (Rapid)", safra: 2, dam: 0.5 }, { label: "Bati' (Slow)", balgham: 1.5, sauda: 1 }, { label: MOTADIL } ] },
      { label: "Qiwam-e-Aala (Vessel consistency)", labelLocal: "Hardness of the arterial wall", options: [
        { label: "Sulb (Hard)", sauda: 1.5, safra: 1 }, { label: "Layyin (Soft)", balgham: 1.5, dam: 0.5 }, { label: MOTADIL } ] },
      { label: "Imtila-o-Khala (Fullness)", labelLocal: "Fullness of the vessel", options: [
        { label: "Mumtali (Full)", dam: 2 }, { label: "Khali (Empty)", sauda: 1, safra: 0.5 }, { label: MOTADIL } ] },
      { label: "Harr-o-Bard (Temperature to touch)", labelLocal: "Warmth felt under the fingers", required: true, weight: 1.2, options: [
        { label: "Haar (Warm)", safra: 1.5, dam: 1 }, { label: "Barid (Cool)", balgham: 1.5, sauda: 1 }, { label: MOTADIL } ] },
      { label: "Zaman-e-Sukoon (Rest interval)", labelLocal: "Pause between beats", options: [
        { label: "Mutawatir (Frequent)", safra: 1.5, dam: 0.5 }, { label: "Mutafawit (Spaced)", balgham: 1, sauda: 1 }, { label: MOTADIL } ] },
      { label: "Istiwa-o-Ikhtilaf (Regularity)", labelLocal: "Beats alike or varying", options: [
        { label: "Mustawi (Regular)" }, { label: "Mukhtalif (Irregular)", sauda: 1.5 } ] },
      { label: "Nizam (Order)", labelLocal: "Pattern of irregularity", options: [
        { label: "Muntazim (Ordered)" }, { label: "Ghair Muntazim (Disordered)", sauda: 1 } ] },
      { label: "Wazan (Rhythm)", labelLocal: "Ratio of movement to rest", options: [
        { label: "Jayyid-ul-Wazan (Good rhythm)" }, { label: "Radi-ul-Wazan (Poor rhythm)", sauda: 0.5, safra: 0.5 } ] },
    ],
  },
  {
    key: "baul", label: "Baul (Urine)", english: "Urine examination",
    description: "Classical inspection of urine — colour, consistency, sediment, odour and quantity.",
    questions: [
      { label: "Laun (Colour)", required: true, weight: 1.2, options: [
        { label: "Asfar / Nari (Deep yellow, fiery)", safra: 2 }, { label: "Ahmar (Reddish)", dam: 2 },
        { label: "Abyaz (Pale, white)", balgham: 2 }, { label: "Aswad / Kamid (Dark, dusky)", sauda: 2 }, { label: "Utruji (Straw) — Mu'tadil" } ] },
      { label: "Qiwam (Consistency)", options: [
        { label: "Raqeeq (Thin, watery)", balgham: 1, safra: 0.5 }, { label: "Ghaleez (Thick, turbid)", dam: 1, balgham: 1 }, { label: MOTADIL } ] },
      { label: "Rasub (Sediment)", options: [
        { label: "None" }, { label: "White, uniform (normal)" }, { label: "Reddish / sandy", dam: 1, safra: 0.5 },
        { label: "Dark / blackish", sauda: 1.5 }, { label: "Mucoid / slimy", balgham: 1.5 } ] },
      { label: "Raiha (Odour)", options: [
        { label: "Haad (Sharp, pungent)", safra: 1.5 }, { label: "Odourless", balgham: 1 }, { label: "Foul (Ufoonat — putrefaction)", safra: 1, dam: 1 }, { label: MOTADIL } ] },
      { label: "Miqdar (Quantity)", options: [
        { label: "Qaleel (Scanty)", safra: 1, sauda: 0.5 }, { label: "Kaseer (Copious)", balgham: 1.5 }, { label: MOTADIL } ] },
    ],
  },
  {
    key: "baraz", label: "Baraz (Stool)", english: "Stool examination",
    description: "Colour, consistency and odour of the stool.",
    questions: [
      { label: "Laun (Colour)", options: [
        { label: "Yellowish", safra: 1.5 }, { label: "Pale / whitish", balgham: 1.5 }, { label: "Dark / blackish", sauda: 1.5 }, { label: "Brown (normal)" } ] },
      { label: "Qiwam (Consistency)", required: true, options: [
        { label: "Loose / liquid", safra: 1.5 }, { label: "Mucoid / slimy", balgham: 1.5 }, { label: "Hard / dry pellets", sauda: 1.5 }, { label: "Formed (normal)" } ] },
      { label: "Raiha (Odour)", options: [
        { label: "Very foul", safra: 1, dam: 0.5 }, { label: "Sour", balgham: 1 }, { label: "Mild (normal)" } ] },
    ],
  },
  {
    key: "lisan", label: "Lisan (Tongue)", english: "Tongue inspection",
    description: "Colour, coating and moisture of the tongue.",
    questions: [
      { label: "Laun (Colour)", required: true, options: [
        { label: "Red, bright", dam: 1.5, safra: 0.5 }, { label: "Yellowish tinge", safra: 1.5 },
        { label: "Pale / whitish", balgham: 1.5 }, { label: "Dusky / bluish", sauda: 1.5 }, { label: "Pink (normal)" } ] },
      { label: "Coating (Ghisha)", options: [
        { label: "Yellow fur", safra: 2 }, { label: "Thick white coat", balgham: 2 }, { label: "Dark / blackish coat", sauda: 2 }, { label: "Thin, clean (normal)" } ] },
      { label: "Rutubat (Moisture)", options: [
        { label: "Dry, parched", safra: 1, sauda: 1 }, { label: "Very moist, salivating", balgham: 1.5 }, { label: MOTADIL } ] },
    ],
  },
  {
    key: "zahiri", label: "Zahiri Mu'ayana", english: "Physical inspection",
    description: "Complexion, build, skin to the touch and hair — classical outward signs of temperament.",
    questions: [
      { label: "Laun-e-Badan (Complexion)", options: [
        { label: "Reddish, ruddy", dam: 1.5 }, { label: "Yellowish, sallow", safra: 1.5 },
        { label: "Pale, white", balgham: 1.5 }, { label: "Dark, dusky", sauda: 1.5 }, { label: "Wheatish (balanced)" } ] },
      { label: "Hay'at-e-Aza (Body build)", options: [
        { label: "Muscular, well-built", dam: 1.5 }, { label: "Lean, wiry", safra: 1.5 },
        { label: "Plump, soft", balgham: 1.5 }, { label: "Thin, dry", sauda: 1.5 } ] },
      { label: "Malmas (Skin to the touch)", required: true, options: [
        { label: "Warm and moist", dam: 1.5 }, { label: "Hot and dry", safra: 1.5 },
        { label: "Cool and moist", balgham: 1.5 }, { label: "Cool and dry", sauda: 1.5 } ] },
      { label: "Sha'r (Hair)", options: [
        { label: "Thick, dark, abundant", dam: 0.5, safra: 0.5 }, { label: "Sparse, soft, light", balgham: 1 },
        { label: "Thin, dry, early greying", sauda: 1 } ] },
      { label: "Other findings", type: "text" },
    ],
  },
];

type L = { label: string; localName?: string; description?: string };
const LISTS: Record<string, L[]> = {
  mizaj: [
    { label: "Mu'tadil", description: "Balanced temperament" },
    { label: "Damawi", localName: "Haar-Ratab", description: "Sanguine — hot & moist" },
    { label: "Safrawi", localName: "Haar-Yabis", description: "Bilious — hot & dry" },
    { label: "Balghami", localName: "Barid-Ratab", description: "Phlegmatic — cold & moist" },
    { label: "Saudawi", localName: "Barid-Yabis", description: "Melancholic — cold & dry" },
    { label: "Haar", description: "Hot (simple)" },
    { label: "Barid", description: "Cold (simple)" },
    { label: "Ratab", description: "Moist (simple)" },
    { label: "Yabis", description: "Dry (simple)" },
  ],
  organ: [
    { label: "Dimagh", description: "Brain" }, { label: "A'sab", description: "Nerves" }, { label: "Qalb", description: "Heart" },
    { label: "Riya", description: "Lungs" }, { label: "Meda", description: "Stomach" }, { label: "Kabid", description: "Liver" },
    { label: "Mirarah", description: "Gall bladder" }, { label: "Tihal", description: "Spleen" }, { label: "Ama", description: "Intestines" },
    { label: "Kulya", description: "Kidneys" }, { label: "Masana", description: "Bladder" }, { label: "Rahim", description: "Uterus" },
    { label: "Unsayain", description: "Testes" }, { label: "Jild", description: "Skin" }, { label: "Mafasil", description: "Joints" },
    { label: "Ayn", description: "Eye" }, { label: "Uzn", description: "Ear" }, { label: "Halq", description: "Throat" },
  ],
  usool: [
    { label: "Izala-e-Sabab", description: "Removal of the cause" },
    { label: "Tadeel-e-Mizaj", description: "Correction of the temperament" },
    { label: "Munzij-Mushil therapy", description: "Concoction then evacuation of morbid humours (Tanqiya)" },
    { label: "Istifragh-e-Mawad", description: "Evacuation of morbid matter" },
    { label: "Imala-e-Mawad", description: "Diversion of morbid matter" },
    { label: "Taqwiyat-e-Aza", description: "Strengthening of the affected organs" },
    { label: "Tasheeh-e-Ghiza", description: "Dietary correction" },
    { label: "Islah-e-Asbab-e-Sitta", description: "Correction of the six essential factors" },
    { label: "Taskeen-e-Alam", description: "Relief of pain" },
  ],
  ghiza: [
    { label: "Barley water (Ma-ush-Shaeer)", description: "Cold & moist — cooling, light" },
    { label: "Cucumber (Khiyar)", description: "Cold & moist" },
    { label: "Bottle gourd (Kaddu / Lauki)", description: "Cold & moist — easily digested" },
    { label: "Pomegranate (Anar)", description: "Cold — astringent, cools bile" },
    { label: "Watermelon (Tarbuz)", description: "Cold & moist" },
    { label: "Yoghurt (Dahi)", description: "Cold & moist" },
    { label: "Milk (Laban)", description: "Moist, nourishing" },
    { label: "Green gram (Moong dal)", description: "Light, balanced" },
    { label: "Mutton broth (Yakhni)", description: "Hot & moist — restorative" },
    { label: "Honey (Asal)", description: "Hot & dry" },
    { label: "Dates (Khurma)", description: "Hot & moist" },
    { label: "Ginger (Zanjabeel)", description: "Hot & dry — carminative" },
    { label: "Garlic (Seer)", description: "Hot & dry" },
    { label: "Red chilli & black pepper", description: "Hot & dry — heating" },
    { label: "Fried & fatty food", description: "Heavy, heating" },
    { label: "Black tea & coffee", description: "Hot & dry, dehydrating" },
    { label: "Sour citrus & vinegar", description: "Cold & dry, sharp" },
    { label: "Brinjal (Badinjan)", description: "Hot & dry — produces Sauda" },
    { label: "Beef (Laham-e-Baqar)", description: "Heavy — produces Sauda" },
    { label: "Rice (Aruz)", description: "Cold & moist" },
    { label: "Cold & iced drinks", description: "Cold — weakens digestion" },
  ],
  tadbeer: [
    { label: "Hijama bila Shart", description: "Dry cupping" },
    { label: "Hijama bi Shart", description: "Wet cupping" },
    { label: "Dalk", description: "Therapeutic massage" },
    { label: "Hammam", description: "Bathing" },
    { label: "Riyazat", description: "Exercise" },
    { label: "Nutool", description: "Irrigation (pouring of medicated fluid)" },
    { label: "Takmeed", description: "Fomentation" },
    { label: "Inkebab", description: "Medicated steam inhalation" },
    { label: "Zimad / Tila", description: "Medicated paste / liniment" },
    { label: "Taleeq", description: "Leech therapy" },
    { label: "Fasd", description: "Venesection" },
    { label: "Ishal", description: "Purgation" },
    { label: "Qai", description: "Emesis" },
    { label: "Idrar-e-Baul", description: "Diuresis" },
    { label: "Tareeq", description: "Diaphoresis" },
  ],
  dosage_form: [
    "Khamira", "Majoon", "Jawarish", "Itrifal", "Laooq", "Sharbat", "Arq", "Joshanda", "Khisanda", "Safoof",
    "Habb (Pill)", "Qurs (Tablet)", "Capsule", "Roghan (Oil)", "Marham (Ointment)", "Zimad (Paste)", "Kushta",
  ].map((label) => ({ label })),
  timing: [
    "Morning, empty stomach", "Before meals", "After meals", "Twice daily", "Three times daily",
    "At bedtime", "As needed (when required)",
  ].map((label) => ({ label })),
  prognosis: [
    { label: "Favourable", description: "Expected to resolve with adherence" },
    { label: "Guarded", description: "Improvement expected; close follow-up needed" },
    { label: "Poor", description: "Limited improvement expected — consider referral" },
  ],
};

export async function seedTashkheesConfig() {
  // Dala'il sections (always ensure they exist) + their starter questions once.
  for (const [i, p] of DALAIL.entries()) {
    await db.asbabPillar.upsert({
      where: { key: p.key }, update: {},
      create: { framework: "dalail", key: p.key, label: p.label, english: p.english, description: p.description, sortOrder: i },
    });
  }
  const marker = await db.portalSetting.findUnique({ where: { category_key: { category: "seed_versions", key: "tashkhees" } } });
  if (marker) return;

  for (const p of DALAIL) {
    const pillar = await db.asbabPillar.findUnique({ where: { key: p.key } });
    if (!pillar || (await db.asbabQuestion.count({ where: { pillarId: pillar.id } }))) continue;
    for (const [qi, q] of p.questions.entries()) {
      await db.asbabQuestion.create({
        data: {
          pillarId: pillar.id, label: q.label, labelLocal: q.labelLocal ?? null, type: q.type ?? "single_select",
          required: !!q.required, weight: q.weight ?? 1, sortOrder: qi,
          options: { create: (q.options || []).map((o, oi) => ({ label: o.label, description: o.description ?? null, safra: o.safra ?? 0, dam: o.dam ?? 0, balgham: o.balgham ?? 0, sauda: o.sauda ?? 0, sortOrder: oi })) },
        },
      });
    }
  }
  for (const [list, items] of Object.entries(LISTS)) {
    if (await db.tashkheesOption.count({ where: { list } })) continue;
    await db.tashkheesOption.createMany({
      data: items.map((it, i) => ({ list, label: it.label, localName: it.localName ?? null, description: it.description ?? null, sortOrder: i })),
    });
  }
  await db.portalSetting.create({ data: { category: "seed_versions", key: "tashkhees", value: "1" } });
}
