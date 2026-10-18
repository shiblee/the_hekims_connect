import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/notifications";
import { LANDING_EN_STRINGS } from "@/lib/i18n/seed-data/landing-en";
import { PAGES_EN } from "@/lib/i18n/seed-data/pages-en";
import { VITALS_RANGE_FIELDS, DEFAULT_NORMAL_RANGES, DEFAULT_ENTRY_BOUNDS } from "@/lib/vitals-ranges";

const AVATAR_COLORS = ["teal", "amber", "emerald", "rose", "violet", "cyan"];

const LANGUAGES = [
  { code: "en", name: "English", englishName: "English", direction: "ltr", enabled: true, isDefault: true, sortOrder: 0 },
  { code: "hi", name: "हिन्दी", englishName: "Hindi", direction: "ltr", enabled: false, isDefault: false, sortOrder: 1 },
  { code: "ur", name: "اردو", englishName: "Urdu", direction: "rtl", enabled: false, isDefault: false, sortOrder: 2 },
  { code: "ar", name: "العربية", englishName: "Arabic", direction: "rtl", enabled: false, isDefault: false, sortOrder: 3 },
  { code: "fa", name: "فارسی", englishName: "Farsi", direction: "rtl", enabled: false, isDefault: false, sortOrder: 4 },
];

/**
 * Idempotent — safe to call every time, including on an already-seeded
 * database (unlike seedDatabase's demo data, which only seeds once).
 */
export async function seedTranslations() {
  for (const l of LANGUAGES) {
    await db.language.upsert({ where: { code: l.code }, update: {}, create: l });
  }
  for (const s of LANDING_EN_STRINGS) {
    const key = await db.translationKey.upsert({
      where: { key: s.key },
      update: { group: s.group, description: s.description, sourceText: s.sourceText },
      create: { key: s.key, group: s.group, description: s.description, sourceText: s.sourceText },
    });
    await db.translationValue.upsert({
      where: { keyId_languageCode: { keyId: key.id, languageCode: "en" } },
      update: { text: s.sourceText, status: "published", source: "manual" },
      create: { keyId: key.id, languageCode: "en", text: s.sourceText, status: "published", source: "manual" },
    });
  }
}

/**
 * Idempotent — only creates a page/English content if it doesn't already exist,
 * so re-running never clobbers content an admin has since edited.
 */
export async function seedPages() {
  for (const p of PAGES_EN) {
    const page = await db.page.upsert({
      where: { slug: p.slug },
      update: {},
      create: { slug: p.slug, title: p.title },
    });
    const existing = await db.pageContent.findUnique({
      where: { pageId_languageCode: { pageId: page.id, languageCode: "en" } },
    });
    if (!existing) {
      await db.pageContent.create({
        data: {
          pageId: page.id,
          languageCode: "en",
          title: p.title,
          subtitle: p.subtitle,
          body: p.body,
          status: "published",
        },
      });
    }
  }
}

export async function seedMetadata() {
  // All option lists below are intentionally Unani-only — this is a pure Unani medicine
  // platform, never allopathic/Ayurvedic/homeopathic terminology (facility_type and
  // service_emergency are institution/operational categories, not medical-system-specific,
  // so they're left generic).
  const metadataSections: { key: string; label: string; category: string; options: string[] }[] = [
    { key: "facility_type", label: "Facility Type", category: "Facility", options: ["Hospital", "Clinic", "Nursing Home", "Health Centre", "Other"] },
    {
      key: "specialization", label: "Specialization", category: "Facility", options: [
        "Moalijat (General Medicine)", "Qabalat-o-Amraze Niswan (Gynaecology & Obstetrics)",
        "Amraze Atfal (Paediatrics)", "Jarahat (Surgery)", "Ilaj-bil-Tadbeer (Regimenal Therapy)",
        "Ilaj-bil-Ghiza (Dietotherapy)", "Amraze Jild wa Tazeeniyat (Dermatology & Cosmetology)",
        "Ain, Uzn, Anaf, Halaq (Eye, Ear, Nose & Throat)", "Kulliyat (Basic Principles of Unani Medicine)",
        "Tahaffuzi wa Samaji Tib (Preventive & Social Medicine)", "Ilmul Advia (Pharmacology)",
        "Munafeul Aza (Physiology)", "Other",
      ],
    },
    {
      key: "service_diagnostic", label: "Diagnostic & Examination Services", category: "Facility", options: [
        "Nabz Shanasi (Pulse Diagnosis)", "Qarurat Mualaina (Urine Examination)",
        "Baraz Mualaina (Stool Examination)", "Mizaj Tashkhis (Temperament Diagnosis)", "Other",
      ],
    },
    { key: "service_emergency", label: "Emergency Services", category: "Facility", options: ["Emergency Department", "Ambulance", "24×7 Emergency"] },
    {
      key: "service_maternal_child", label: "Qabalat-o-Amraze Niswan wa Atfal (Maternal & Child Health)", category: "Facility", options: [
        "Qabalat (Delivery / Obstetric Care)", "Amraze Niswan (Gynaecological Care)",
        "Amraze Atfal (Paediatric Care)", "Ilaj-bil-Ghiza for Mother & Child", "Other",
      ],
    },
    {
      key: "service_other", label: "Other Unani Services", category: "Facility", options: [
        "Dawakhana (Unani Pharmacy)", "Hijama (Cupping Therapy)", "Dalk (Massage Therapy)",
        "Hammam (Bath / Steam Therapy)", "Fasd (Venesection)", "Jarahat Theatre (Operation Theatre)", "Other",
      ],
    },
    { key: "staff_employee_type", label: "Employee Type", category: "Staff", options: ["Hakim (Unani Physician)", "Nurse", "Counsellor", "ANM", "ASHA", "Data Entry Operator", "Cashier", "Other"] },
    {
      // Mirrors the facility-level "specialization" list exactly, so a Hakim's individual
      // specialization is always selectable from the same set the facility itself offers.
      key: "staff_specialization", label: "Staff Specialization", category: "Staff", options: [
        "Moalijat (General Medicine)", "Qabalat-o-Amraze Niswan (Gynaecology & Obstetrics)",
        "Amraze Atfal (Paediatrics)", "Jarahat (Surgery)", "Ilaj-bil-Tadbeer (Regimenal Therapy)",
        "Ilaj-bil-Ghiza (Dietotherapy)", "Amraze Jild wa Tazeeniyat (Dermatology & Cosmetology)",
        "Ain, Uzn, Anaf, Halaq (Eye, Ear, Nose & Throat)", "Kulliyat (Basic Principles of Unani Medicine)",
        "Tahaffuzi wa Samaji Tib (Preventive & Social Medicine)", "Ilmul Advia (Pharmacology)",
        "Munafeul Aza (Physiology)", "Other",
      ],
    },
    { key: "staff_qualification", label: "Staff Qualification", category: "Staff", options: ["BUMS (Bachelor of Unani Medicine & Surgery)", "MD (Unani)", "Diploma in Unani Medicine (DUMS)", "B.Sc Nursing", "GNM", "ANM", "Other"] },
    { key: "staff_designation", label: "Staff Designation", category: "Staff", options: ["Resident Hakim", "Senior Hakim", "Consultant Hakim", "Staff Nurse", "Senior Nurse", "Counsellor", "Data Entry Operator", "Receptionist", "Other"] },
    { key: "staff_role", label: "Staff Role", category: "Staff", options: ["Hakim", "Staff Nurse", "Counsellor", "Administrator", "Support Staff", "Other"] },
    { key: "staff_responsibility", label: "Staff Responsibility", category: "Staff", options: ["Patient Consultation", "Mizaj Assessment", "Ilaj-bil-Tadbeer", "Prescription Management", "Appointment Scheduling", "Patient Follow-up", "Front Desk", "Other"] },
    { key: "relationship", label: "Relationship", category: "Patient", options: ["Self", "Spouse", "Son", "Daughter", "Father", "Mother", "Other"] },
    { key: "gender", label: "Gender", category: "Patient", options: ["Male", "Female", "Other", "Prefer not to say"] },
    { key: "marital_status", label: "Marital Status", category: "Patient", options: ["Single", "Married", "Widowed", "Divorced", "Separated", "Other"] },
    { key: "payment_mode", label: "Payment Mode", category: "Patient", options: ["Cash", "UPI", "Card", "Bank Transfer", "Other"] },
  ];
  for (let i = 0; i < metadataSections.length; i++) {
    const s = metadataSections[i];
    const section = await db.metadataSection.upsert({
      where: { key: s.key },
      update: { category: s.category },
      create: { key: s.key, label: s.label, category: s.category, sortOrder: i },
    });
    // Add-only: only create options that don't exist yet by label, so re-running
    // this seed can introduce newly-added options (e.g. a new role) to a section
    // that already has data, without touching anything an admin has since edited.
    const existingOptions = await db.metadataOption.findMany({ where: { sectionId: section.id }, select: { label: true } });
    const existingLabels = new Set(existingOptions.map((o) => o.label));
    const missing = s.options.filter((label) => !existingLabels.has(label));
    if (missing.length) {
      await db.metadataOption.createMany({
        data: missing.map((label, idx) => ({ sectionId: section.id, label, sortOrder: existingOptions.length + idx })),
      });
    }
  }

  await db.portalSetting.upsert({
    where: { category_key: { category: "patient_defaults", key: "default_state" } },
    update: {},
    create: { category: "patient_defaults", key: "default_state", value: "Uttar Pradesh" },
  });
  await db.portalSetting.upsert({
    where: { category_key: { category: "patient_defaults", key: "default_city" } },
    update: {},
    create: { category: "patient_defaults", key: "default_city", value: "Lucknow" },
  });
  await db.portalSetting.upsert({
    where: { category_key: { category: "vitals", key: "edit_window_minutes" } },
    update: {},
    create: { category: "vitals", key: "edit_window_minutes", value: "60" },
  });

  // Admin-configurable min/max for each vitals field — the starting values
  // are the same defaults vitals-ranges.ts used to hardcode. "update: {}"
  // means re-seeding never clobbers a value the admin has already changed.
  for (const field of VITALS_RANGE_FIELDS) {
    const [normalMin, normalMax] = DEFAULT_NORMAL_RANGES[field];
    const [entryMin, entryMax] = DEFAULT_ENTRY_BOUNDS[field];
    const rows: [string, string][] = [
      [`${field}_normal_min`, String(normalMin)],
      [`${field}_normal_max`, String(normalMax)],
      [`${field}_entry_min`, String(entryMin)],
      [`${field}_entry_max`, String(entryMax)],
    ];
    for (const [key, value] of rows) {
      await db.portalSetting.upsert({
        where: { category_key: { category: "vitals_validation", key } },
        update: {},
        create: { category: "vitals_validation", key, value },
      });
    }
  }
}

/**
 * The starter chief complaint list (L1 Screening and Main Complaints pick from
 * it). Idempotent by key, same as seedMetadata — safe to re-run.
 */
export async function seedScreeningConfig() {
  const complaints = [
    { key: "fever", label: "Fever", labelLocal: "बुखार", category: "General / Constitutional" },
    { key: "general_weakness", label: "General Weakness / Debility (Zo'f-e-Aam)", labelLocal: "आम कमज़ोरी", category: "General / Constitutional" },
    { key: "excessive_thirst", label: "Excessive Thirst (Fart-e-Atash)", labelLocal: "अत्यधिक प्यास", category: "General / Constitutional" },
    { key: "insomnia", label: "Insomnia / Sleeplessness (Sahar)", labelLocal: "नींद न आना", category: "General / Constitutional" },

    { key: "abdominal_pain", label: "Abdominal Pain", labelLocal: "पेट दर्द", category: "Digestive" },
    { key: "indigestion", label: "Indigestion (Su'-e-Hazm)", labelLocal: "अपच", category: "Digestive" },
    { key: "acidity_heartburn", label: "Acidity / Heartburn (Humuzat-e-Mi'da)", labelLocal: "एसिडिटी", category: "Digestive" },
    { key: "constipation", label: "Constipation (Qabz)", labelLocal: "कब्ज़", category: "Digestive" },
    { key: "loose_motion", label: "Loose Motion / Diarrhea (Ishal)", labelLocal: "दस्त", category: "Digestive" },
    { key: "vomiting", label: "Vomiting (Qai)", labelLocal: "उल्टी", category: "Digestive" },
    { key: "piles", label: "Piles (Bawaseer)", labelLocal: "बवासीर", category: "Digestive" },
    { key: "worm_infestation", label: "Worm Infestation (Dud-e-Ama'a)", labelLocal: "पेट के कीड़े", category: "Digestive" },

    { key: "cough_breathing", label: "Cough / Breathing Difficulty", labelLocal: "खांसी / सांस लेने में तकलीफ", category: "Respiratory" },
    { key: "common_cold", label: "Common Cold (Zukam)", labelLocal: "जुकाम", category: "Respiratory" },
    { key: "sore_throat", label: "Sore Throat (Waja-ul-Halaq)", labelLocal: "गले में दर्द", category: "Respiratory" },
    { key: "asthma_breathlessness", label: "Asthma / Breathlessness (Rabv)", labelLocal: "दमा", category: "Respiratory" },

    { key: "joint_pain", label: "Joint Pain", labelLocal: "जोड़ों का दर्द", category: "Musculoskeletal" },
    { key: "back_pain", label: "Back Pain (Waja-ul-Zahr)", labelLocal: "कमर दर्द", category: "Musculoskeletal" },
    { key: "sciatica", label: "Sciatica (Irq-un-Nasa)", labelLocal: "सायटिका", category: "Musculoskeletal" },
    { key: "muscular_pain", label: "Muscular Pain (Waja-ul-Adhal)", labelLocal: "मांसपेशियों में दर्द", category: "Musculoskeletal" },

    { key: "skin_rash_itching", label: "Skin Rash / Itching (Hikka)", labelLocal: "खुजली", category: "Skin" },
    { key: "boils_acne", label: "Boils / Acne (Dammal)", labelLocal: "फोड़े-फुंसी", category: "Skin" },
    { key: "hair_fall", label: "Hair Fall (Su-qut-e-Sha'ar)", labelLocal: "बालों का झड़ना", category: "Skin" },

    { key: "menstrual_problem", label: "Menstrual Problem", labelLocal: "मासिक धर्म की समस्या", category: "Gynae & Reproductive" },
    { key: "leucorrhea", label: "Leucorrhea / White Discharge (Sayalan-ur-Rahem)", labelLocal: "सफेद पानी", category: "Gynae & Reproductive" },
    { key: "infertility_concern", label: "Infertility Concern (Uqm)", labelLocal: "बांझपन", category: "Gynae & Reproductive" },

    { key: "burning_urination", label: "Burning Urination (Hurqat-ul-Baul)", labelLocal: "पेशाब में जलन", category: "Urinary" },
    { key: "frequent_urination", label: "Frequent Urination (Kasrat-ul-Baul)", labelLocal: "बार-बार पेशाब आना", category: "Urinary" },
    { key: "kidney_stone_pain", label: "Kidney Stone Pain (Hasat)", labelLocal: "पथरी का दर्द", category: "Urinary" },

    { key: "eye_problem", label: "Eye Problem (Amraz-e-Chashm)", labelLocal: "आँखों की समस्या", category: "ENT & Eye" },
    { key: "ear_problem", label: "Ear Problem (Amraz-e-Uzn)", labelLocal: "कान की समस्या", category: "ENT & Eye" },
    { key: "toothache", label: "Toothache (Waja-ul-Asnan)", labelLocal: "दांत में दर्द", category: "ENT & Eye" },

    { key: "chest_pain", label: "Chest Pain (Waja-us-Sadr)", labelLocal: "सीने में दर्द", category: "Cardiac" },
    { key: "palpitations", label: "Palpitations (Khafqan)", labelLocal: "धड़कन तेज़ होना", category: "Cardiac" },

    { key: "headache", label: "Headache (Suda'a)", labelLocal: "सरदर्द", category: "Neurological & Mental Health" },
    { key: "memory_weakness", label: "Memory Weakness (Zu'f-e-Hafiza)", labelLocal: "याददाश्त कमज़ोर होना", category: "Neurological & Mental Health" },
    { key: "anxiety_stress", label: "Anxiety / Stress (Waswas)", labelLocal: "चिंता", category: "Neurological & Mental Health" },
    { key: "low_mood", label: "Low Mood / Melancholia (Malikholia)", labelLocal: "उदासी", category: "Neurological & Mental Health" },
  ];
  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    await db.chiefComplaint.upsert({
      where: { key: c.key },
      // Backfill category onto already-seeded rows too (this field didn't
      // exist when the first batch was seeded) — safe since it's the only
      // thing touched on an update, same add-only spirit as the rest of this
      // seed; everything else an admin may have edited stays untouched.
      update: { category: c.category },
      create: { key: c.key, label: c.label, labelLocal: c.labelLocal, category: c.category, sortOrder: i },
      select: { id: true },
    });
  }
}

/**
 * Junior Hakeem Intake Protocol Phase 1 — a starter set of manifestations,
 * factor tags, and humor weight rules for a couple of high-traffic
 * complaints. Idempotent by key/label, same convention as seedScreeningConfig.
 * Point values here are an illustrative clinical starting point for admin
 * review, not a finished calibration — tune via Admin → Humoral Matrix.
 */
export async function seedHumorConfig() {
  const manifestationSeeds: Record<string, { key: string; label: string }[]> = {
    fever: [
      { key: "chills", label: "Chills" },
      { key: "night_sweats", label: "Night sweats" },
      { key: "rigors", label: "Rigors" },
    ],
    headache: [
      { key: "photophobia", label: "Photophobia" },
      { key: "nausea", label: "Nausea" },
      { key: "throbbing_quality", label: "Throbbing quality" },
    ],
  };

  for (const [complaintKey, manifestations] of Object.entries(manifestationSeeds)) {
    const complaint = await db.chiefComplaint.findUnique({ where: { key: complaintKey }, select: { id: true } });
    if (!complaint) continue;
    for (let i = 0; i < manifestations.length; i++) {
      const m = manifestations[i];
      await db.complaintManifestation.upsert({
        where: { chiefComplaintId_key: { chiefComplaintId: complaint.id, key: m.key } },
        update: {},
        create: { chiefComplaintId: complaint.id, key: m.key, label: m.label, sortOrder: i },
      });
    }
  }

  const factorTagSeeds: { kind: "aggravating" | "relieving"; label: string }[] = [
    { kind: "aggravating", label: "Cold exposure" },
    { kind: "aggravating", label: "Food intake" },
    { kind: "aggravating", label: "Exertion" },
    { kind: "aggravating", label: "Stress" },
    { kind: "aggravating", label: "Heat exposure" },
    { kind: "aggravating", label: "Night time" },
    { kind: "relieving", label: "Rest" },
    { kind: "relieving", label: "Warmth" },
    { kind: "relieving", label: "Hydration" },
    { kind: "relieving", label: "Cold compress" },
    { kind: "relieving", label: "Sleep" },
    { kind: "relieving", label: "Massage" },
  ];
  for (let i = 0; i < factorTagSeeds.length; i++) {
    const f = factorTagSeeds[i];
    await db.complaintFactorTag.upsert({
      where: { kind_label: { kind: f.kind, label: f.label } },
      update: {},
      create: { kind: f.kind, label: f.label, sortOrder: i },
    });
  }

  const weightRuleSeeds: { sourceType: string; sourceValue: string; safra?: number; dam?: number; sauda?: number; balgham?: number }[] = [
    { sourceType: "manifestation", sourceValue: "chills", balgham: 2, sauda: 1 },
    { sourceType: "manifestation", sourceValue: "night_sweats", safra: 2 },
    { sourceType: "manifestation", sourceValue: "rigors", sauda: 2, balgham: 1 },
    { sourceType: "manifestation", sourceValue: "photophobia", safra: 2 },
    { sourceType: "manifestation", sourceValue: "nausea", balgham: 1, safra: 1 },
    { sourceType: "manifestation", sourceValue: "throbbing_quality", dam: 2 },
    { sourceType: "factor", sourceValue: "Cold exposure", balgham: 2, sauda: 1 },
    { sourceType: "factor", sourceValue: "Food intake", balgham: 1, dam: 1 },
    { sourceType: "factor", sourceValue: "Exertion", safra: 1, dam: 1 },
    { sourceType: "factor", sourceValue: "Stress", sauda: 2 },
    { sourceType: "factor", sourceValue: "Heat exposure", safra: 2 },
    { sourceType: "factor", sourceValue: "Night time", balgham: 1 },
    { sourceType: "factor", sourceValue: "Rest", dam: 1 },
    { sourceType: "factor", sourceValue: "Warmth", balgham: 1 },
    { sourceType: "factor", sourceValue: "Hydration", safra: 1 },
    { sourceType: "factor", sourceValue: "Cold compress", safra: 1 },
    { sourceType: "factor", sourceValue: "Sleep", dam: 1 },
    { sourceType: "factor", sourceValue: "Massage", dam: 1 },
    { sourceType: "severity_band", sourceValue: "mild", dam: 1 },
    { sourceType: "severity_band", sourceValue: "moderate", safra: 1, sauda: 1 },
    { sourceType: "severity_band", sourceValue: "severe", safra: 2, sauda: 2 },
    { sourceType: "onset_pattern", sourceValue: "Acute", safra: 1, dam: 1 },
    { sourceType: "onset_pattern", sourceValue: "Chronic", sauda: 2 },
    { sourceType: "onset_pattern", sourceValue: "Gradual", balgham: 1 },
    { sourceType: "onset_pattern", sourceValue: "Episodic/Recurrent", sauda: 1, balgham: 1 },
  ];
  for (const r of weightRuleSeeds) {
    await db.humorWeightRule.upsert({
      where: { sourceType_sourceValue: { sourceType: r.sourceType, sourceValue: r.sourceValue } },
      update: {},
      create: {
        sourceType: r.sourceType, sourceValue: r.sourceValue,
        safraPoints: r.safra ?? 0, damPoints: r.dam ?? 0, saudaPoints: r.sauda ?? 0, balghamPoints: r.balgham ?? 0,
        notes: "Seeded starting point — review before relying on clinically.",
      },
    });
  }
}

// Starter allergy checklist for the registration wizard's autosuggest.
// Deliberately scoped to Unani dietotherapy/pharmacopoeia substances (foods
// and herbs actually used in Ilaj-bil-Ghiza and classical formulations) and
// general natural/environmental allergens — not synthetic pharmaceutical
// drug names, since this is a Unani practice, not an allopathic one.
export async function seedAllergyTags() {
  const allergySeeds = [
    "Honey (Asal)",
    "Ghee / Clarified Butter",
    "Milk & Dairy (Laban)",
    "Almonds (Badam)",
    "Walnuts (Akhrot)",
    "Sesame (Til)",
    "Turmeric (Haldi)",
    "Neem (Azadirachta indica)",
    "Henna (Mehndi)",
    "Fenugreek (Methi)",
    "Garlic (Seer)",
    "Ginger (Zanjabeel)",
    "Cinnamon (Darchini)",
    "Saffron (Zafran)",
    "Castor Oil (Rogan-e-Arandi)",
    "Aloe Vera (Gwarpatha)",
    "Wheat / Gluten",
    "Citrus Fruits",
    "Shellfish",
    "Eggs",
    "Pollen",
    "Dust Mites",
    "Animal Dander",
    "Insect Stings (Bee/Wasp)",
    "Latex",
  ];
  for (let i = 0; i < allergySeeds.length; i++) {
    await db.allergyTag.upsert({
      where: { label: allergySeeds[i] },
      update: {},
      create: { label: allergySeeds[i], sortOrder: i },
    });
  }
}

// Starter suggestion lists for the registration wizard's "Active Routine
// Medications / Herbs" field. Unlike allergies, this field legitimately spans
// both Unani/herbal supplements and allopathic prescriptions a patient may
// already be on (relevant for interaction/safety awareness), so both are seeded.
export async function seedMedicationTags() {
  const medicationSeeds: { kind: "supplement" | "medication"; label: string }[] = [
    { kind: "supplement", label: "Ashwagandha" },
    { kind: "supplement", label: "Shilajit" },
    { kind: "supplement", label: "Triphala" },
    { kind: "supplement", label: "Amla (Indian Gooseberry)" },
    { kind: "supplement", label: "Multivitamin" },
    { kind: "supplement", label: "Omega-3 Fish Oil" },
    { kind: "supplement", label: "Magnesium Glycinate" },
    { kind: "supplement", label: "Vitamin D3" },
    { kind: "supplement", label: "Vitamin B12" },
    { kind: "supplement", label: "Iron Supplement" },
    { kind: "supplement", label: "Calcium Supplement" },
    { kind: "supplement", label: "Probiotics" },
    { kind: "medication", label: "Metformin" },
    { kind: "medication", label: "Levothyroxine" },
    { kind: "medication", label: "Amlodipine" },
    { kind: "medication", label: "Atorvastatin" },
    { kind: "medication", label: "Losartan" },
    { kind: "medication", label: "Aspirin (low-dose)" },
    { kind: "medication", label: "Insulin" },
    { kind: "medication", label: "Omeprazole" },
    { kind: "medication", label: "Salbutamol Inhaler" },
    { kind: "medication", label: "Paracetamol (as needed)" },
  ];
  const nextOrder: Record<string, number> = { supplement: 0, medication: 0 };
  for (const m of medicationSeeds) {
    const sortOrder = nextOrder[m.kind]++;
    await db.medicationTag.upsert({
      where: { kind_label: { kind: m.kind, label: m.label } },
      update: {},
      create: { kind: m.kind, label: m.label, sortOrder },
    });
  }
}

// Starter Emergency Warning Signs checklist — standard western
// clinical red flags that must be ruled out before continuing Unani
// constitutional triage. A clinical starting point for admin/practitioner
// review, not a finished or exhaustive emergency-medicine protocol.
export async function seedRedFlagCriteria() {
  const criteriaSeeds: { key: string; label: string; description: string }[] = [
    { key: "chest_pain", label: "Severe acute chest pain / Angina", description: "Excludes acute coronary syndrome" },
    { key: "dyspnea", label: "Acute dyspnea / Respiratory distress", description: "Excludes respiratory failure, PE, or severe asthma/COPD exacerbation" },
    { key: "neuro_deficit", label: "Sudden focal neurological deficit", description: "Excludes stroke / TIA — FAST screen" },
    { key: "abdominal_rigidity", label: "Severe abdominal rigidity / Peritonitis", description: "Excludes surgical abdomen" },
    { key: "altered_consciousness", label: "Altered consciousness / GCS < 15", description: "Excludes stroke, metabolic crisis, or head injury" },
    { key: "uncontrolled_bleeding", label: "Severe or uncontrolled bleeding", description: "Excludes active hemorrhage" },
    { key: "sepsis_signs", label: "Signs of sepsis / Septic shock", description: "Fever with hypotension, tachycardia, or confusion" },
    { key: "anaphylaxis", label: "Signs of anaphylaxis / Severe allergic reaction", description: "Airway swelling, widespread urticaria, or hypotension after exposure" },
  ];
  for (let i = 0; i < criteriaSeeds.length; i++) {
    const c = criteriaSeeds[i];
    await db.redFlagCriterion.upsert({
      where: { key: c.key },
      update: {},
      create: { key: c.key, label: c.label, description: c.description, sortOrder: i },
    });
  }
}

// Starter "Accompanying Acute Symptoms" checklist for the Chief Complaint
// Matrix — general constitutional/acute markers, not tied to one complaint.
// A clinical starting point for admin review, not a finished list.
export async function seedAcuteSymptomTags() {
  const symptomSeeds: { label: string; description: string }[] = [
    { label: "Burning epigastric sensation", description: "Post-prandial pyrosis" },
    { label: "Bitter taste in mouth", description: "Dast-e-Talkh (Safra indicator)" },
    { label: "Restlessness & insomnia", description: "Sahar / Night vigil" },
    { label: "Dry throat with intense thirst", description: "Atash-e-Mufrit" },
    { label: "Cold extremities / Shivering", description: "Buroodat marker" },
    { label: "Excessive salivation / Nausea", description: "Luzujat marker" },
  ];
  for (let i = 0; i < symptomSeeds.length; i++) {
    const s = symptomSeeds[i];
    await db.acuteSymptomTag.upsert({
      where: { label: s.label },
      update: {},
      create: { label: s.label, description: s.description, sortOrder: i },
    });
  }
}

// Starter Anatomical Region & Organ System cards for Stage 3. Seeded only
// into an empty table, so an admin's renames/removals are never undone.
export async function seedAnatomicalRegionTags() {
  if (await db.anatomicalRegionTag.count()) return;
  const regions: { label: string; localTerms: string; icon: string }[] = [
    { label: "Gastrointestinal / Hepato-Biliary", localTerms: "Ma'ida / Kabid / Safra", icon: "apple" },
    { label: "Cranial / Neurological", localTerms: "Dimagh / A'sab / Cephalea", icon: "brain" },
    { label: "Musculoskeletal / Cervical", localTerms: "'Izam / Mafasil", icon: "bone" },
    { label: "Respiratory / Sadr", localTerms: "Tanaffus / Ri'ah", icon: "wind" },
    { label: "Dermatological / Jild", localTerms: "Bishrah / Hikka", icon: "hand" },
    { label: "Renal / Urinary", localTerms: "Kulyah / Masanah", icon: "droplet" },
  ];
  await db.anatomicalRegionTag.createMany({ data: regions.map((r, i) => ({ ...r, sortOrder: i })) });
}

// Full organ-system list (v2), added once on top of whatever exists — a
// version marker in PortalSetting means regions an admin later renames or
// deactivates are never re-added. Labels already present are skipped.
const ANATOMICAL_REGIONS_V2: { label: string; localTerms: string; icon: string; gender: "all" | "male" | "female" }[] = [
  { label: "General / Systemic", localTerms: "Badan / Humma / Zof-e-Aam", icon: "stethoscope", gender: "all" },
  { label: "Cardiovascular / Qalb", localTerms: "Qalb / Shara'een / Awrida", icon: "heart", gender: "all" },
  { label: "Spinal / Back", localTerms: "Fiqrat / Zahr / Qatan", icon: "bone", gender: "all" },
  { label: "Limbs & Peripheral Vessels", localTerms: "Atraf / Awrida-e-Atraf", icon: "footprints", gender: "all" },
  { label: "Ophthalmic / Ayn", localTerms: "Ayn / Jafn / Basarat", icon: "eye", gender: "all" },
  { label: "Ear, Nose & Throat", localTerms: "Uzn / Anf / Halq", icon: "ear", gender: "all" },
  { label: "Oral & Dental / Fam", localTerms: "Fam / Asnan / Lisan / Lissa", icon: "smile", gender: "all" },
  { label: "Endocrine & Metabolic", localTerms: "Ghudad / Istehala", icon: "flask", gender: "all" },
  { label: "Blood & Lymphatic", localTerms: "Dam / Tihal / Ghudad-e-Lamfawiya", icon: "droplets", gender: "all" },
  { label: "Psychological / Nafsani", localTerms: "Nafs / Quwa-e-Nafsaniya", icon: "mind", gender: "all" },
  { label: "Anorectal / Maq'ad", localTerms: "Maq'ad / Bawaseer / Shuqaq", icon: "dot", gender: "all" },
  { label: "Gynaecological / Rahim", localTerms: "Rahim / Mabiz / Haiz", icon: "venus", gender: "female" },
  { label: "Obstetric / Pregnancy", localTerms: "Haml / Wiladat / Nifas", icon: "baby", gender: "female" },
  { label: "Breast / Sadi", localTerms: "Sadi / Pistan / Laban", icon: "ribbon", gender: "female" },
  { label: "Male Reproductive / Andrological", localTerms: "Unsayain / Qazib / Ghudda-e-Mazi", icon: "mars", gender: "male" },
];

export async function seedAnatomicalRegionTagsV2() {
  const marker = await db.portalSetting.findUnique({ where: { category_key: { category: "seed_versions", key: "anatomical_regions" } } });
  if (marker && Number(marker.value) >= 2) return;
  const existing = new Set((await db.anatomicalRegionTag.findMany({ select: { label: true } })).map((r) => r.label.toLowerCase()));
  let order = ((await db.anatomicalRegionTag.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
  for (const r of ANATOMICAL_REGIONS_V2) {
    if (existing.has(r.label.toLowerCase())) continue;
    await db.anatomicalRegionTag.create({ data: { ...r, sortOrder: order++ } });
  }
  await db.portalSetting.upsert({
    where: { category_key: { category: "seed_versions", key: "anatomical_regions" } },
    update: { value: "2" },
    create: { category: "seed_versions", key: "anatomical_regions", value: "2" },
  });
}

// Starter "Onset Nature & Rhythm" options for Stage 3. Seeded only into an
// empty table, so an admin's edits are never undone.
export async function seedOnsetPatternTags() {
  if (await db.onsetPatternTag.count()) return;
  const patterns: { label: string; description: string }[] = [
    { label: "Sudden Paroxysmal", description: "Abrupt onset, comes in attacks" },
    { label: "Insidious Gradual", description: "Slow, creeping onset" },
    { label: "Post-Prandial Exacerbation", description: "Worse after meals" },
    { label: "Nocturnal Exacerbation (Layli)", description: "Worse at night" },
  ];
  await db.onsetPatternTag.createMany({ data: patterns.map((p, i) => ({ ...p, sortOrder: i })) });
}

// v3: place the default regions on the Stage 3 body map. Only fills regions
// that have no body area yet, once (version marker), so admin choices stand.
export async function seedAnatomicalRegionZonesV3() {
  const marker = await db.portalSetting.findUnique({ where: { category_key: { category: "seed_versions", key: "anatomical_regions" } } });
  if (marker && Number(marker.value) >= 3) return;
  const { DEFAULT_REGION_ZONES } = await import("@/lib/body-zones");
  const regions = await db.anatomicalRegionTag.findMany({ where: { bodyZone: null }, select: { id: true, label: true } });
  for (const r of regions) {
    const zone = DEFAULT_REGION_ZONES[r.label];
    if (zone) await db.anatomicalRegionTag.update({ where: { id: r.id }, data: { bodyZone: zone } });
  }
  await db.portalSetting.upsert({
    where: { category_key: { category: "seed_versions", key: "anatomical_regions" } },
    update: { value: "3" },
    create: { category: "seed_versions", key: "anatomical_regions", value: "3" },
  });
}

export async function seedEmailTemplates() {
  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
}

export async function seedDatabase() {
  await seedTranslations();
  await seedPages();
  await seedMetadata();
  await seedScreeningConfig();
  await seedHumorConfig();
  await seedAllergyTags();
  await seedMedicationTags();
  await seedRedFlagCriteria();
  await seedAcuteSymptomTags();
  await seedAnatomicalRegionTags();
  await seedAnatomicalRegionTagsV2();
  await seedAnatomicalRegionZonesV3();
  await (await import("@/lib/asbab-seed")).seedAsbabConfig();
  await (await import("@/lib/tashkhees-seed")).seedTashkheesConfig();
  await seedOnsetPatternTags();
  await seedEmailTemplates();

  // Check if already seeded
  const facilityCount = await db.facility.count();
  if (facilityCount > 0) return false;

  await db.admin.create({
    data: {
      name: "Site Administrator",
      email: "admin@hekims.connect",
      password: hashPassword("admin12345"),
    },
  });

  const defaultSettings = [
    { category: "general", key: "portal_name", value: "The Hekim's Connect" },
    { category: "general", key: "support_email", value: "care@hekims.connect" },
    { category: "general", key: "support_phone", value: "+91 98765 43210" },
    { category: "registration", key: "facility_registration_enabled", value: "true" },
    { category: "registration", key: "patient_registration_enabled", value: "true" },
    { category: "registration", key: "require_license_for_facility", value: "false" },
    { category: "verification", key: "otp_expiry_minutes", value: "10" },
    { category: "verification", key: "otp_resend_cooldown_seconds", value: "30" },
    { category: "verification", key: "max_otp_attempts", value: "5" },
    { category: "verification", key: "max_login_attempts", value: "5" },
    { category: "verification", key: "lockout_duration_minutes", value: "15" },
    { category: "subscription", key: "free_trial_months", value: "3" },
    { category: "subscription", key: "paid_plan_price_per_month", value: "999" },
    { category: "subscription", key: "currency", value: "INR" },
    { category: "chief_complaint_assistant", key: "enabled", value: "false" },
    { category: "chief_complaint_assistant", key: "interval_minutes", value: "1440" },
    { category: "allergy_assistant", key: "enabled", value: "false" },
    { category: "allergy_assistant", key: "interval_minutes", value: "1440" },
    { category: "supplement_assistant", key: "enabled", value: "false" },
    { category: "supplement_assistant", key: "interval_minutes", value: "1440" },
    { category: "medication_assistant", key: "enabled", value: "false" },
    { category: "medication_assistant", key: "interval_minutes", value: "1440" },
  ];
  for (const s of defaultSettings) {
    await db.portalSetting.upsert({
      where: { category_key: { category: s.category, key: s.key } },
      update: {},
      create: s,
    });
  }

  const facilityPassword = hashPassword("facility123");

  const cityClinic = await db.facility.create({
    data: {
      facilityName: "City Unani Clinic",
      email: "cityunani@hekims.connect",
      phone: "9876543210",
      password: facilityPassword,
      license: "UNI-2017-0432",
      specialization: "Senior Unani Practice",
      experience: 8,
      rating: 4.9,
      bio: "A multi-practitioner Unani clinic specialising in Mizaj balance, Regimental therapy (Hijama, Dalk) and chronic disease management through classical Unani formulations.",
      avatarColor: "teal",
      verified: true,
    },
  });

  const wellnessCenter = await db.facility.create({
    data: {
      facilityName: "Wellness Unani Center",
      email: "wellness@hekims.connect",
      phone: "9876543211",
      password: facilityPassword,
      license: "UNI-2019-0511",
      specialization: "Unani Dietotherapy",
      experience: 6,
      rating: 4.8,
      bio: "Focused on Ilaj-bil-Ghadha (dietotherapy) and lifestyle correction for metabolic disorders.",
      avatarColor: "amber",
      verified: true,
    },
  });

  const patientPassword = hashPassword("patient123");

  const mark = await db.patient.create({
    data: {
      name: "Mark Jaxon",
      email: "mark@patient.connect",
      phone: "9811100001",
      password: patientPassword,
      dob: "1989-04-12",
      gender: "Male",
      bloodGroup: "B+",
      address: "42, Lodi Road, New Delhi, India",
      emergencyContact: "+919811100002 (Spouse)",
      occupation: "Software Engineer",
      height: "178 cm",
      weight: "82 kg",
      familyHistory: "Father: Type 2 Diabetes; Mother: Hypertension",
      medicalHistory: "Chronic lower back pain since 2021. Occasional migraines.",
      chronicConditions: "Chronic back pain, Pre-diabetes",
      allergies: "Penicillin, Pollen",
      currentMedications: "Majoon Suranjan 5g BD, Metformin 500mg OD",
      surgicalHistory: "Appendectomy (2015)",
      lifestyle: "Sedentary, irregular meals, disturbed sleep",
      mizaj: "Safrawi",
      avatarColor: "amber",
    },
  });

  const alexa = await db.patient.create({
    data: {
      name: "Alexa Max",
      email: "alexa@patient.connect",
      phone: "9811100003",
      password: patientPassword,
      dob: "1995-11-23",
      gender: "Female",
      bloodGroup: "O+",
      address: "7, Carter Road, Mumbai, India",
      emergencyContact: "+919811100004 (Brother)",
      occupation: "Teacher",
      height: "165 cm",
      weight: "58 kg",
      familyHistory: "Mother: Asthma",
      medicalHistory: "Recurrent knee pain, seasonal allergies",
      chronicConditions: "Osteoarthritis (early)",
      allergies: "Dust, Paracetamol (rash)",
      currentMedications: "Arq-e-Gulab topical",
      surgicalHistory: "None",
      lifestyle: "Active, vegetarian diet",
      mizaj: "Balghami",
      avatarColor: "rose",
    },
  });

  const brick = await db.patient.create({
    data: {
      name: "Brick Zon",
      email: "brick@patient.connect",
      phone: "9811100005",
      password: patientPassword,
      dob: "1978-07-30",
      gender: "Male",
      bloodGroup: "A+",
      address: "11, Park Street, Kolkata, India",
      emergencyContact: "+919811100006 (Daughter)",
      occupation: "Business Owner",
      height: "172 cm",
      weight: "91 kg",
      familyHistory: "Father: Cardiac disease",
      medicalHistory: "Hypertension, dyslipidemia",
      chronicConditions: "Hypertension, Hyperlipidemia",
      allergies: "None known",
      currentMedications: "Amlodipine 5mg, Khamira Marwarid 10g",
      surgicalHistory: "None",
      lifestyle: "Smoker (occasional), rich diet",
      mizaj: "Damwi",
      avatarColor: "cyan",
    },
  });

  // Appointments
  const today = new Date().toISOString().slice(0, 10);
  await db.appointment.createMany({
    data: [
      {
        facilityId: cityClinic.id,
        patientId: mark.id,
        date: today,
        time: "08:00",
        type: "Chronic Pain Consultation",
        reason: "Back pain flare-up",
        status: "scheduled",
      },
      {
        facilityId: cityClinic.id,
        patientId: alexa.id,
        date: today,
        time: "09:30",
        type: "Mizaj Assessment Review",
        reason: "Knee pain, Safra imbalance",
        status: "scheduled",
      },
      {
        facilityId: cityClinic.id,
        patientId: brick.id,
        date: today,
        time: "12:30",
        type: "Pharmacy Refill Check",
        reason: "Khamira Marwarid refill",
        status: "scheduled",
      },
      {
        facilityId: wellnessCenter.id,
        patientId: mark.id,
        date: today,
        time: "15:00",
        type: "Dietotherapy Follow-up",
        reason: "Diet plan review",
        status: "scheduled",
      },
    ],
  });

  // Messages (Alexa <-> Dr Colter)
  await db.message.createMany({
    data: [
      {
        senderId: alexa.id,
        senderType: "patient",
        receiverId: cityClinic.id,
        receiverType: "facility",
        content: "Hi, Doctor. My knee hurts again.",
      },
      {
        senderId: alexa.id,
        senderType: "patient",
        receiverId: cityClinic.id,
        receiverType: "facility",
        content: "Should I increase the dose of the herbal balm?",
      },
      {
        senderId: cityClinic.id,
        senderType: "facility",
        receiverId: alexa.id,
        receiverType: "patient",
        content:
          "Hello, Alexa. Please keep the dose consistent for now. It takes time for the Safra mizaj to balance.",
      },
    ],
  });

  // Mizaj assessment for Mark
  await db.mizajAssessment.create({
    data: {
      patientId: mark.id,
      facilityId: cityClinic.id,
      dam: 35,
      saffra: 55,
      balgham: 20,
      sauda: 25,
      result: "Safrawi (Yellow Bile) dominant",
      pulse: "Rapid, hard and hot. Indicates excess yellow bile.",
      notes: "Recommend cooling diet and Ilaj-bil-Tadbeer (Hammam-e-Barid).",
    },
  });

  // Pharmacy items
  await db.pharmacyItem.createMany({
    data: [
      { name: "Majoon Suranjan", category: "Formulation", form: "Powder", quantity: 240, unit: "g", reorderLevel: 50, price: 320, expiryDate: "2026-08-01", description: "Anti-inflammatory Unani formulation for joint disorders" },
      { name: "Arq-e-Gulab (Special)", category: "Distillate", form: "Liquid", quantity: 60, unit: "ml", reorderLevel: 20, price: 120, expiryDate: "2027-01-01", description: "Rose water distillate, cooling & soothing" },
      { name: "Khamira Marwarid", category: "Khamira", form: "Semi-solid", quantity: 18, unit: "jar", reorderLevel: 10, price: 540, expiryDate: "2026-05-15", description: "Pearl-based tonic, cardiac & general weakness" },
      { name: "Habb-e-Asgand", category: "Tablet", form: "Tablet", quantity: 150, unit: "tab", reorderLevel: 40, price: 90, expiryDate: "2026-11-01", description: "General tonic, anti-stress" },
      { name: "Roghan Baboona", category: "Oil", form: "Oil", quantity: 8, unit: "btl", reorderLevel: 12, price: 210, expiryDate: "2026-09-01", description: "Massage oil for insomnia & anxiety" },
      { name: "Joshanda", category: "Decoction", form: "Powder", quantity: 90, unit: "sachet", reorderLevel: 30, price: 35, expiryDate: "2026-07-01", description: "Herbal decoction for cold & flu" },
      { name: "Itrifal Mulayyan", category: "Formulation", form: "Powder", quantity: 5, unit: "jar", reorderLevel: 10, price: 280, expiryDate: "2026-06-01", description: "Laxative & blood purifier" },
      { name: "Sharbat Bazoori", category: "Syrup", form: "Liquid", quantity: 25, unit: "btl", reorderLevel: 15, price: 150, expiryDate: "2027-03-01", description: "Diuretic, hepatic tonic" },
    ],
  });

  // A sample prescription
  await db.prescription.create({
    data: {
      patientId: mark.id,
      facilityId: cityClinic.id,
      therapyType: "Ilaj-bil-Dawa",
      items: JSON.stringify([
        { name: "Majoon Suranjan", dose: "5g", frequency: "Twice daily", instructions: "After meals with lukewarm water" },
        { name: "Arq-e-Gulab (Special)", dose: "40ml", frequency: "Morning", instructions: "Empty stomach" },
      ]),
      notes: "Continue for 2 weeks. Review Mizaj at next visit.",
    },
  });

  return true;
}

export { AVATAR_COLORS };
