import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/notifications";
import { LANDING_EN_STRINGS } from "@/lib/i18n/seed-data/landing-en";
import { PAGES_EN } from "@/lib/i18n/seed-data/pages-en";

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
    { key: "patient_title", label: "Patient Title", category: "Patient", options: ["Mr.", "Mrs.", "Ms.", "Miss", "Master", "Baby", "Dr.", "Other"] },
    { key: "registration_for", label: "Registration For", category: "Patient", options: ["Self", "Spouse", "Child", "Parent", "Other Family Member"] },
    { key: "relationship", label: "Relationship", category: "Patient", options: ["Self", "Spouse", "Son", "Daughter", "Father", "Mother", "Other"] },
    { key: "emergency_relationship", label: "Emergency Contact Relationship", category: "Patient", options: ["Spouse", "Son", "Daughter", "Father", "Mother", "Sibling", "Friend", "Other"] },
    { key: "gender", label: "Gender", category: "Patient", options: ["Male", "Female", "Other", "Prefer not to say"] },
    { key: "marital_status", label: "Marital Status", category: "Patient", options: ["Single", "Married", "Widowed", "Divorced", "Separated", "Other"] },
    { key: "blood_group", label: "Blood Group", category: "Patient", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] },
    { key: "payment_mode", label: "Payment Mode", category: "Payment", options: ["Cash", "UPI", "Card", "Bank Transfer", "Other"] },
    { key: "payment_status", label: "Payment Status", category: "Payment", options: ["Paid", "Partially Paid", "Pending", "Waived"] },
    {
      // Merged city+state picker for patient registration — each option is
      // "City, State" so selecting one resolves both fields at once. A starting
      // set of major cities/towns across every state & union territory; admins
      // can add more through this same Meta section, same as any other list.
      key: "city", label: "City", category: "Patient", options: [
        "Lucknow, Uttar Pradesh", "Kanpur, Uttar Pradesh", "Varanasi, Uttar Pradesh", "Agra, Uttar Pradesh",
        "Meerut, Uttar Pradesh", "Prayagraj, Uttar Pradesh", "Noida, Uttar Pradesh", "Ghaziabad, Uttar Pradesh",
        "Bareilly, Uttar Pradesh", "Aligarh, Uttar Pradesh", "Moradabad, Uttar Pradesh", "Gorakhpur, Uttar Pradesh",
        "Saharanpur, Uttar Pradesh", "Jhansi, Uttar Pradesh", "Ayodhya, Uttar Pradesh",
        "Mumbai, Maharashtra", "Pune, Maharashtra", "Nagpur, Maharashtra", "Nashik, Maharashtra",
        "Aurangabad, Maharashtra", "Thane, Maharashtra", "Solapur, Maharashtra", "Kolhapur, Maharashtra",
        "New Delhi, Delhi", "Delhi, Delhi",
        "Bengaluru, Karnataka", "Mysuru, Karnataka", "Hubballi, Karnataka", "Mangaluru, Karnataka", "Belagavi, Karnataka",
        "Chennai, Tamil Nadu", "Coimbatore, Tamil Nadu", "Madurai, Tamil Nadu", "Tiruchirappalli, Tamil Nadu",
        "Salem, Tamil Nadu", "Tirunelveli, Tamil Nadu",
        "Hyderabad, Telangana", "Warangal, Telangana", "Nizamabad, Telangana",
        "Ahmedabad, Gujarat", "Surat, Gujarat", "Vadodara, Gujarat", "Rajkot, Gujarat",
        "Bhavnagar, Gujarat", "Jamnagar, Gujarat", "Gandhinagar, Gujarat",
        "Jaipur, Rajasthan", "Jodhpur, Rajasthan", "Udaipur, Rajasthan", "Kota, Rajasthan",
        "Ajmer, Rajasthan", "Bikaner, Rajasthan",
        "Kolkata, West Bengal", "Howrah, West Bengal", "Durgapur, West Bengal",
        "Asansol, West Bengal", "Siliguri, West Bengal",
        "Bhopal, Madhya Pradesh", "Indore, Madhya Pradesh", "Gwalior, Madhya Pradesh",
        "Jabalpur, Madhya Pradesh", "Ujjain, Madhya Pradesh",
        "Patna, Bihar", "Gaya, Bihar", "Bhagalpur, Bihar", "Muzaffarpur, Bihar", "Darbhanga, Bihar",
        "Thiruvananthapuram, Kerala", "Kochi, Kerala", "Kozhikode, Kerala", "Thrissur, Kerala", "Kollam, Kerala",
        "Guwahati, Assam", "Silchar, Assam", "Dibrugarh, Assam",
        "Ranchi, Jharkhand", "Jamshedpur, Jharkhand", "Dhanbad, Jharkhand", "Bokaro, Jharkhand",
        "Bhubaneswar, Odisha", "Cuttack, Odisha", "Rourkela, Odisha",
        "Ludhiana, Punjab", "Amritsar, Punjab", "Jalandhar, Punjab", "Patiala, Punjab", "Mohali, Punjab",
        "Gurugram, Haryana", "Faridabad, Haryana", "Panipat, Haryana", "Ambala, Haryana", "Hisar, Haryana",
        "Raipur, Chhattisgarh", "Bhilai, Chhattisgarh", "Bilaspur, Chhattisgarh",
        "Dehradun, Uttarakhand", "Haridwar, Uttarakhand", "Nainital, Uttarakhand", "Haldwani, Uttarakhand",
        "Shimla, Himachal Pradesh", "Dharamshala, Himachal Pradesh", "Manali, Himachal Pradesh",
        "Srinagar, Jammu and Kashmir", "Jammu, Jammu and Kashmir",
        "Leh, Ladakh",
        "Chandigarh, Chandigarh",
        "Panaji, Goa", "Margao, Goa",
        "Visakhapatnam, Andhra Pradesh", "Vijayawada, Andhra Pradesh", "Guntur, Andhra Pradesh",
        "Nellore, Andhra Pradesh", "Tirupati, Andhra Pradesh",
        "Itanagar, Arunachal Pradesh",
        "Imphal, Manipur",
        "Shillong, Meghalaya",
        "Aizawl, Mizoram",
        "Kohima, Nagaland", "Dimapur, Nagaland",
        "Agartala, Tripura",
        "Gangtok, Sikkim",
        "Puducherry, Puducherry",
        "Port Blair, Andaman and Nicobar Islands",
        "Daman, Dadra and Nagar Haveli and Daman and Diu", "Silvassa, Dadra and Nagar Haveli and Daman and Diu",
        "Kavaratti, Lakshadweep",
      ],
    },
    { key: "spo2_context", label: "SpO2 Context", category: "Patient", options: ["Known Oxygen Sensitivity", "High CO2 or COPD", "None"] },
    { key: "consciousness_level", label: "Level of Consciousness", category: "Patient", options: ["Alert (A)", "Verbal (V)", "Pain (P)", "Unresponsive (U)"] },
    { key: "mood", label: "Mood", category: "Patient", options: ["Very Good", "Good", "Neutral", "Bad", "Very Bad"] },
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
}

/**
 * A small general-OPD L1 Screening example set — proves every mechanism works
 * end-to-end (chief-complaint triggering, gender gating, age gating, numeric
 * dual-threshold flags, every question type) without trying to be exhaustive.
 * Idempotent by key, same as seedMetadata — safe to re-run.
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
  const complaintRows: Record<string, { id: string }> = {};
  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    complaintRows[c.key] = await db.chiefComplaint.upsert({
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

  const ADULT_MIN_AGE_DAYS = 18 * 365;

  type QuestionSeed = {
    label: string; labelLocal?: string; instructionText?: string;
    type: "single_select" | "multi_select" | "numeric" | "text" | "instruction";
    applicableGender?: string; minAgeDays?: number; maxAgeDays?: number;
    numericOperator?: string; numericThreshold?: number; numericFlagSeverity?: string;
    numericOperator2?: string; numericThreshold2?: number; numericFlagSeverity2?: string;
    options?: { label: string; labelLocal?: string; flagSeverity?: string }[];
  };

  // Shared option sets — reused across modules so the same Unani/Hindi
  // phrasing for a Yes/No or Mild/Moderate/Severe answer stays consistent
  // everywhere it appears.
  const yn = (yesFlag?: string, noFlag?: string) => [
    { label: "Yes", labelLocal: "हाँ", flagSeverity: yesFlag },
    { label: "No", labelLocal: "नहीं", flagSeverity: noFlag },
  ];
  const mms = (flags: [string?, string?, string?] = ["green", "yellow", "red"]) => [
    { label: "Mild (Khafif)", labelLocal: "हल्का", flagSeverity: flags[0] },
    { label: "Moderate (Mutawassit)", labelLocal: "मध्यम", flagSeverity: flags[1] },
    { label: "Severe (Shadid)", labelLocal: "गंभीर", flagSeverity: flags[2] },
  ];

  const modules: { key: string; label: string; triggers: string[]; questions: QuestionSeed[] }[] = [
    {
      key: "fever_assessment", label: "Fever Assessment", triggers: ["fever"],
      questions: [
        {
          label: "Measured Temperature (°F) (Hararat)", labelLocal: "मापा गया तापमान (°F)", type: "numeric",
          numericOperator: ">", numericThreshold: 104, numericFlagSeverity: "red",
          numericOperator2: ">", numericThreshold2: 100.4, numericFlagSeverity2: "yellow",
        },
        {
          label: "Duration of Fever (Muddat-e-Humma)", labelLocal: "बुखार की अवधि", type: "single_select",
          options: [
            { label: "1-2 days", labelLocal: "1-2 दिन", flagSeverity: "green" },
            { label: "3-5 days", labelLocal: "3-5 दिन", flagSeverity: "yellow" },
            { label: "More than 5 days", labelLocal: "5 दिन से ज़्यादा", flagSeverity: "red" },
          ],
        },
        { label: "Associated Rigors / Chills", labelLocal: "साथ में कंपकंपी / सर्दी लगना", type: "single_select", options: yn("yellow") },
        { label: "Ask the caregiver to describe any other associated symptoms.", labelLocal: "देखभाल करने वाले से अन्य लक्षणों के बारे में पूछें।", type: "instruction", instructionText: "Ask the caregiver to describe any other associated symptoms." },
      ],
    },
    {
      key: "abdominal_pain_assessment", label: "Abdominal Pain Assessment", triggers: ["abdominal_pain"],
      questions: [
        { label: "Pain Severity (Shiddat-e-Waja)", labelLocal: "दर्द की गंभीरता", type: "single_select", options: mms() },
        { label: "Associated Vomiting (Qai)", labelLocal: "साथ में उल्टी", type: "single_select", options: yn("yellow") },
        { label: "Blood in Stool (Dam)", labelLocal: "मल में खून", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "respiratory_assessment", label: "Respiratory Assessment", triggers: ["cough_breathing"],
      questions: [
        {
          label: "Breathing Rate (breaths/min) (Sur'at-e-Tanaffus)", labelLocal: "सांस लेने की दर (प्रति मिनट)", type: "numeric",
          numericOperator: ">", numericThreshold: 30, numericFlagSeverity: "red",
          numericOperator2: ">", numericThreshold2: 24, numericFlagSeverity2: "yellow",
        },
        {
          label: "Type of Symptoms", labelLocal: "लक्षणों का प्रकार", type: "multi_select",
          options: [
            { label: "Cough (Su'aal)", labelLocal: "खांसी", flagSeverity: "green" },
            { label: "Wheeze", labelLocal: "सांस में घरघराहट", flagSeverity: "yellow" },
            { label: "Chest Pain (Waja-us-Sadr)", labelLocal: "सीने में दर्द", flagSeverity: "red" },
            { label: "Blood in Sputum (Dam)", labelLocal: "बलगम में खून", flagSeverity: "red" },
          ],
        },
        { label: "How long has this been going on?", labelLocal: "यह कब से हो रहा है?", type: "text" },
      ],
    },
    {
      key: "menstrual_history", label: "Menstrual History", triggers: ["menstrual_problem"],
      questions: [
        { label: "Cycle Regularity (Intizam-e-Haiz)", labelLocal: "माहवारी की नियमितता", type: "single_select", applicableGender: "female", options: [{ label: "Regular", labelLocal: "नियमित", flagSeverity: "green" }, { label: "Irregular", labelLocal: "अनियमित", flagSeverity: "yellow" }] },
        { label: "Heavy Bleeding (Kasrat-e-Haiz)", labelLocal: "अधिक रक्तस्राव", type: "single_select", applicableGender: "female", options: yn("red") },
        { label: "Days Since Last Period", labelLocal: "पिछली माहवारी के बाद के दिन", type: "numeric", applicableGender: "female", numericOperator: ">", numericThreshold: 90, numericFlagSeverity: "yellow" },
      ],
    },
    {
      key: "joint_pain_assessment", label: "Joint Pain Assessment", triggers: ["joint_pain"],
      questions: [
        { label: "Joint Swelling Present (Waram-ul-Mafasil)", labelLocal: "जोड़ों में सूजन", type: "single_select", minAgeDays: ADULT_MIN_AGE_DAYS, options: yn("yellow") },
        {
          label: "Pain Duration (Muddat-e-Waja)", labelLocal: "दर्द की अवधि", type: "single_select", minAgeDays: ADULT_MIN_AGE_DAYS,
          options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "1-4 weeks", labelLocal: "1-4 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 4 weeks", labelLocal: "4 हफ़्ते से ज़्यादा", flagSeverity: "red" }],
        },
        { label: "Mobility Affected", labelLocal: "चलने-फिरने में असर", type: "single_select", minAgeDays: ADULT_MIN_AGE_DAYS, options: yn("yellow") },
      ],
    },
    {
      key: "headache_assessment", label: "Headache Assessment", triggers: ["headache"],
      questions: [
        { label: "Severity (Shiddat)", labelLocal: "गंभीरता", type: "single_select", options: mms() },
        { label: "Sudden Onset (\"Thunderclap\")", labelLocal: "अचानक और तेज़ शुरुआत", type: "single_select", options: yn("red") },
        { label: "Associated Vomiting (Qai)", labelLocal: "साथ में उल्टी", type: "single_select", options: yn("yellow") },
        { label: "Vision Disturbance (Kalal-e-Basar)", labelLocal: "नज़र में गड़बड़ी", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "cold_assessment", label: "Common Cold Assessment", triggers: ["common_cold"],
      questions: [
        { label: "Nasal Discharge Type (Nazla)", labelLocal: "नाक से स्राव का प्रकार", type: "single_select", options: [{ label: "Watery", labelLocal: "पानी जैसा", flagSeverity: "green" }, { label: "Thick Yellow-Green", labelLocal: "गाढ़ा पीला-हरा", flagSeverity: "yellow" }] },
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "1-2 weeks", labelLocal: "1-2 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 2 weeks", labelLocal: "2 हफ़्ते से ज़्यादा", flagSeverity: "red" }] },
        { label: "Associated Fever (Humma)", labelLocal: "साथ में बुखार", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "throat_assessment", label: "Sore Throat Assessment", triggers: ["sore_throat"],
      questions: [
        { label: "Difficulty Swallowing (Usr-ul-Bala)", labelLocal: "निगलने में कठिनाई", type: "single_select", options: yn("red") },
        { label: "Throat Appearance", labelLocal: "गले का रूप", type: "single_select", options: [{ label: "Normal", labelLocal: "सामान्य", flagSeverity: "green" }, { label: "Red", labelLocal: "लाल", flagSeverity: "yellow" }, { label: "White Patches", labelLocal: "सफ़ेद धब्बे", flagSeverity: "red" }] },
        { label: "Voice Change (Bahuhat)", labelLocal: "आवाज़ में बदलाव", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "indigestion_assessment", label: "Indigestion Assessment", triggers: ["indigestion"],
      questions: [
        { label: "Bloating Severity (Nafkh)", labelLocal: "पेट फूलने की गंभीरता", type: "single_select", options: mms() },
        { label: "Associated Chest Pain (Waja-us-Sadr)", labelLocal: "साथ में सीने में दर्द", type: "single_select", options: yn("red") },
        { label: "Relation to Meals", labelLocal: "खाने से संबंध", type: "text" },
      ],
    },
    {
      key: "acidity_assessment", label: "Acidity / Heartburn Assessment", triggers: ["acidity_heartburn"],
      questions: [
        { label: "Frequency (Kasrat)", labelLocal: "आवृत्ति", type: "single_select", options: [{ label: "Occasional", labelLocal: "कभी-कभी", flagSeverity: "green" }, { label: "Daily", labelLocal: "रोज़ाना", flagSeverity: "yellow" }, { label: "Multiple Times Daily", labelLocal: "दिन में कई बार", flagSeverity: "red" }] },
        { label: "Blood in Vomit (Dam)", labelLocal: "उल्टी में खून", type: "single_select", options: yn("red") },
        { label: "Black / Tarry Stool", labelLocal: "काला मल", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "constipation_assessment", label: "Constipation Assessment", triggers: ["constipation"],
      questions: [
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 3 days", labelLocal: "3 दिन से कम", flagSeverity: "green" }, { label: "3-7 days", labelLocal: "3-7 दिन", flagSeverity: "yellow" }, { label: "More than 7 days", labelLocal: "7 दिन से ज़्यादा", flagSeverity: "red" }] },
        { label: "Blood in Stool (Dam)", labelLocal: "मल में खून", type: "single_select", options: yn("red") },
        { label: "Abdominal Pain Present", labelLocal: "पेट दर्द है", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "diarrhea_assessment", label: "Loose Motion Assessment", triggers: ["loose_motion"],
      questions: [
        {
          label: "Frequency (times/day) (Kasrat-e-Ishal)", labelLocal: "आवृत्ति (बार/दिन)", type: "numeric",
          numericOperator: ">", numericThreshold: 6, numericFlagSeverity: "red",
          numericOperator2: ">", numericThreshold2: 3, numericFlagSeverity2: "yellow",
        },
        { label: "Blood / Mucus in Stool (Dam)", labelLocal: "मल में खून/बलगम", type: "single_select", options: yn("red") },
        { label: "Signs of Dehydration (Sunken Eyes / Dry Mouth) (Qillat-ul-Ma)", labelLocal: "डिहाइड्रेशन के लक्षण (धंसी आँखें / सूखा मुँह)", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "vomiting_assessment", label: "Vomiting Assessment", triggers: ["vomiting"],
      questions: [
        {
          label: "Frequency (times/day) (Kasrat-e-Qai)", labelLocal: "आवृत्ति (बार/दिन)", type: "numeric",
          numericOperator: ">", numericThreshold: 5, numericFlagSeverity: "red",
          numericOperator2: ">", numericThreshold2: 2, numericFlagSeverity2: "yellow",
        },
        { label: "Blood in Vomit (Dam)", labelLocal: "उल्टी में खून", type: "single_select", options: yn("red") },
        { label: "Unable to Keep Fluids Down", labelLocal: "पानी भी नहीं रुक रहा", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "piles_assessment", label: "Piles Assessment", triggers: ["piles"],
      questions: [
        { label: "Bleeding Present (Dam)", labelLocal: "रक्तस्राव है", type: "single_select", options: yn("yellow") },
        { label: "Severe Pain (Shiddat-e-Waja)", labelLocal: "तेज़ दर्द", type: "single_select", options: yn("yellow") },
        { label: "Mass / Prolapse Coming Out (Khuruj-ul-Maqad)", labelLocal: "मांस/बवासीर बाहर आना", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "worms_assessment", label: "Worm Infestation Assessment", triggers: ["worm_infestation"],
      questions: [
        { label: "Visible Worms in Stool", labelLocal: "मल में दिखने वाले कीड़े", type: "single_select", options: yn("yellow") },
        { label: "Itching Around Anus", labelLocal: "मलद्वार के आसपास खुजली", type: "single_select", options: yn("green") },
        { label: "Unexplained Weight Loss (Dubul)", labelLocal: "अस्पष्ट वज़न घटना", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "asthma_assessment", label: "Asthma / Breathlessness Assessment", triggers: ["asthma_breathlessness"],
      questions: [
        { label: "Severity (Shiddat-e-Rabv)", labelLocal: "गंभीरता", type: "single_select", options: [{ label: "Mild (Khafif)", labelLocal: "हल्का", flagSeverity: "green" }, { label: "Moderate (Mutawassit)", labelLocal: "मध्यम", flagSeverity: "yellow" }, { label: "Severe — cannot speak full sentences (Shadid)", labelLocal: "गंभीर — पूरा वाक्य नहीं बोल पा रहे", flagSeverity: "red" }] },
        { label: "Blue Lips / Fingertips (Zurqat)", labelLocal: "होंठ/उंगलियों का नीला पड़ना", type: "single_select", options: yn("red") },
        { label: "Nighttime Symptoms", labelLocal: "रात में लक्षण", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "back_pain_assessment", label: "Back Pain Assessment", triggers: ["back_pain"],
      questions: [
        { label: "Radiating to Leg", labelLocal: "पैर की तरफ दर्द फैलना", type: "single_select", options: yn("yellow") },
        { label: "Loss of Bladder / Bowel Control (Salas-ul-Baul)", labelLocal: "पेशाब/मल पर नियंत्रण खोना", type: "single_select", options: yn("red") },
        { label: "Duration (Muddat-e-Waja)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "1-4 weeks", labelLocal: "1-4 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 4 weeks", labelLocal: "4 हफ़्ते से ज़्यादा", flagSeverity: "red" }] },
      ],
    },
    {
      key: "sciatica_assessment", label: "Sciatica Assessment", triggers: ["sciatica"],
      questions: [
        { label: "Numbness / Weakness in Leg (Khadar)", labelLocal: "पैर में सुन्नपन/कमज़ोरी", type: "single_select", minAgeDays: ADULT_MIN_AGE_DAYS, options: yn("red") },
        { label: "Pain Severity (Shiddat-e-Waja)", labelLocal: "दर्द की गंभीरता", type: "single_select", minAgeDays: ADULT_MIN_AGE_DAYS, options: mms() },
      ],
    },
    {
      key: "muscular_pain_assessment", label: "Muscular Pain Assessment", triggers: ["muscular_pain"],
      questions: [
        { label: "Associated Swelling (Waram)", labelLocal: "साथ में सूजन", type: "single_select", options: yn("yellow") },
        { label: "Recent Injury", labelLocal: "हाल की चोट", type: "single_select", options: yn("green") },
        { label: "Severity (Shiddat)", labelLocal: "गंभीरता", type: "single_select", options: mms() },
      ],
    },
    {
      key: "skin_rash_assessment", label: "Skin Rash / Itching Assessment", triggers: ["skin_rash_itching"],
      questions: [
        { label: "Spreading Rapidly", labelLocal: "तेज़ी से फैलना", type: "single_select", options: yn("red") },
        { label: "Associated Fever (Humma)", labelLocal: "साथ में बुखार", type: "single_select", options: yn("red") },
        { label: "Appearance", labelLocal: "रूप", type: "single_select", options: [{ label: "Red Patches", labelLocal: "लाल धब्बे", flagSeverity: "yellow" }, { label: "Blisters", labelLocal: "छाले", flagSeverity: "yellow" }, { label: "Pus-filled (Qaih)", labelLocal: "मवाद भरा", flagSeverity: "red" }] },
      ],
    },
    {
      key: "boils_assessment", label: "Boils / Acne Assessment", triggers: ["boils_acne"],
      questions: [
        {
          label: "Number of Boils (Dammal)", labelLocal: "फोड़ों की संख्या", type: "numeric",
          numericOperator: ">", numericThreshold: 5, numericFlagSeverity: "red",
          numericOperator2: ">", numericThreshold2: 2, numericFlagSeverity2: "yellow",
        },
        { label: "Fever Present (Humma)", labelLocal: "बुखार है", type: "single_select", options: yn("red") },
        { label: "Pus Discharge (Qaih)", labelLocal: "मवाद का स्राव", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "hair_fall_assessment", label: "Hair Fall Assessment", triggers: ["hair_fall"],
      questions: [
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 month", labelLocal: "1 महीने से कम", flagSeverity: "green" }, { label: "1-6 months", labelLocal: "1-6 महीने", flagSeverity: "yellow" }, { label: "More than 6 months", labelLocal: "6 महीने से ज़्यादा", flagSeverity: "yellow" }] },
        { label: "Patchy Bald Spots (Daa-us-Sa'lab)", labelLocal: "गोल गंजेपन के धब्बे", type: "single_select", options: yn("yellow") },
        { label: "Associated Scalp Itching", labelLocal: "सिर की त्वचा में खुजली", type: "single_select", options: yn("green") },
      ],
    },
    {
      key: "leucorrhea_assessment", label: "Leucorrhea Assessment", triggers: ["leucorrhea"],
      questions: [
        { label: "Discharge Color", labelLocal: "स्राव का रंग", type: "single_select", applicableGender: "female", options: [{ label: "White", labelLocal: "सफेद", flagSeverity: "green" }, { label: "Yellow-Green", labelLocal: "पीला-हरा", flagSeverity: "yellow" }, { label: "Blood-tinged", labelLocal: "खून जैसा", flagSeverity: "red" }] },
        { label: "Foul Smell", labelLocal: "दुर्गंध", type: "single_select", applicableGender: "female", options: yn("yellow") },
        { label: "Associated Itching / Burning", labelLocal: "साथ में खुजली/जलन", type: "single_select", applicableGender: "female", options: yn("yellow") },
      ],
    },
    {
      key: "infertility_female_assessment", label: "Infertility — Female Factors", triggers: ["infertility_concern"],
      questions: [
        { label: "Menstrual Regularity (Intizam-e-Haiz)", labelLocal: "माहवारी की नियमितता", type: "single_select", applicableGender: "female", options: [{ label: "Regular", labelLocal: "नियमित", flagSeverity: "green" }, { label: "Irregular", labelLocal: "अनियमित", flagSeverity: "yellow" }] },
        {
          label: "Duration Trying to Conceive (Muddat-e-Uqm)", labelLocal: "गर्भधारण की कोशिश की अवधि", type: "single_select", applicableGender: "female",
          options: [{ label: "Less than 1 year", labelLocal: "1 साल से कम", flagSeverity: "green" }, { label: "1-2 years", labelLocal: "1-2 साल", flagSeverity: "yellow" }, { label: "More than 2 years", labelLocal: "2 साल से ज़्यादा", flagSeverity: "red" }],
        },
      ],
    },
    {
      key: "infertility_male_assessment", label: "Infertility — Male Factors", triggers: ["infertility_concern"],
      questions: [
        {
          label: "Duration Trying to Conceive (Muddat-e-Uqm)", labelLocal: "गर्भधारण की कोशिश की अवधि", type: "single_select", applicableGender: "male",
          options: [{ label: "Less than 1 year", labelLocal: "1 साल से कम", flagSeverity: "green" }, { label: "1-2 years", labelLocal: "1-2 साल", flagSeverity: "yellow" }, { label: "More than 2 years", labelLocal: "2 साल से ज़्यादा", flagSeverity: "red" }],
        },
        { label: "History of Mumps / Testicular Injury", labelLocal: "कण्ठमाला/अंडकोष में चोट का इतिहास", type: "single_select", applicableGender: "male", options: yn("yellow") },
      ],
    },
    {
      key: "burning_urination_assessment", label: "Burning Urination Assessment", triggers: ["burning_urination"],
      questions: [
        { label: "Fever Present (Humma)", labelLocal: "बुखार है", type: "single_select", options: yn("red") },
        { label: "Blood in Urine (Dam)", labelLocal: "पेशाब में खून", type: "single_select", options: yn("red") },
        { label: "Flank Pain", labelLocal: "कमर के पास दर्द", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "frequent_urination_assessment", label: "Frequent Urination Assessment", triggers: ["frequent_urination"],
      questions: [
        { label: "Excessive Thirst Too (Fart-e-Atash)", labelLocal: "साथ में अत्यधिक प्यास", type: "single_select", options: yn("yellow") },
        { label: "Nighttime Frequency (times)", labelLocal: "रात में पेशाब की बारंबारता", type: "numeric", numericOperator: ">", numericThreshold: 3, numericFlagSeverity: "yellow" },
        { label: "Unexplained Weight Loss (Dubul)", labelLocal: "अस्पष्ट वज़न घटना", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "kidney_stone_assessment", label: "Kidney Stone Pain Assessment", triggers: ["kidney_stone_pain"],
      questions: [
        { label: "Pain Severity (Shiddat-e-Waja)", labelLocal: "दर्द की गंभीरता", type: "single_select", options: mms() },
        { label: "Blood in Urine (Dam)", labelLocal: "पेशाब में खून", type: "single_select", options: yn("red") },
        { label: "Fever with Pain (Humma)", labelLocal: "दर्द के साथ बुखार", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "eye_assessment", label: "Eye Problem Assessment", triggers: ["eye_problem"],
      questions: [
        { label: "Sudden Vision Loss (Kalal-e-Basar)", labelLocal: "अचानक नज़र जाना", type: "single_select", options: yn("red") },
        { label: "Eye Pain Severity (Shiddat-e-Waja)", labelLocal: "आँख के दर्द की गंभीरता", type: "single_select", options: mms() },
        { label: "Discharge Present", labelLocal: "स्राव है", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "ear_assessment", label: "Ear Problem Assessment", triggers: ["ear_problem"],
      questions: [
        { label: "Hearing Loss", labelLocal: "सुनने में कमी", type: "single_select", options: yn("yellow") },
        { label: "Discharge / Pus (Qaih)", labelLocal: "स्राव / मवाद", type: "single_select", options: yn("yellow") },
        { label: "Severe Pain (Shiddat-e-Waja)", labelLocal: "तेज़ दर्द", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "toothache_assessment", label: "Toothache Assessment", triggers: ["toothache"],
      questions: [
        { label: "Facial Swelling (Waram)", labelLocal: "चेहरे पर सूजन", type: "single_select", options: yn("red") },
        { label: "Fever Present (Humma)", labelLocal: "बुखार है", type: "single_select", options: yn("red") },
        { label: "Pain Severity (Shiddat-e-Waja)", labelLocal: "दर्द की गंभीरता", type: "single_select", options: [{ label: "Mild (Khafif)", labelLocal: "हल्का", flagSeverity: "green" }, { label: "Moderate (Mutawassit)", labelLocal: "मध्यम", flagSeverity: "yellow" }, { label: "Severe (Shadid)", labelLocal: "गंभीर", flagSeverity: "yellow" }] },
      ],
    },
    {
      key: "chest_pain_assessment", label: "Chest Pain Assessment", triggers: ["chest_pain"],
      questions: [
        { label: "Radiating to Arm / Jaw", labelLocal: "बाँह/जबड़े की तरफ दर्द फैलना", type: "single_select", options: yn("red") },
        { label: "Associated Sweating / Breathlessness", labelLocal: "साथ में पसीना / सांस फूलना", type: "single_select", options: yn("red") },
        { label: "Pain Duration (Muddat-e-Waja)", labelLocal: "दर्द की अवधि", type: "single_select", options: [{ label: "Less than 5 minutes", labelLocal: "5 मिनट से कम", flagSeverity: "green" }, { label: "5-20 minutes", labelLocal: "5-20 मिनट", flagSeverity: "yellow" }, { label: "More than 20 minutes", labelLocal: "20 मिनट से ज़्यादा", flagSeverity: "red" }] },
      ],
    },
    {
      key: "palpitations_assessment", label: "Palpitations Assessment", triggers: ["palpitations"],
      questions: [
        { label: "Associated Chest Pain (Waja-us-Sadr)", labelLocal: "साथ में सीने में दर्द", type: "single_select", options: yn("red") },
        { label: "Fainting / Dizziness", labelLocal: "बेहोशी / चक्कर आना", type: "single_select", options: yn("red") },
        { label: "Duration (minutes)", labelLocal: "अवधि (मिनट)", type: "numeric", numericOperator: ">", numericThreshold: 30, numericFlagSeverity: "yellow" },
      ],
    },
    {
      key: "weakness_assessment", label: "General Weakness Assessment", triggers: ["general_weakness"],
      questions: [
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "1-4 weeks", labelLocal: "1-4 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 4 weeks", labelLocal: "4 हफ़्ते से ज़्यादा", flagSeverity: "red" }] },
        { label: "Unexplained Weight Loss (Dubul)", labelLocal: "अस्पष्ट वज़न घटना", type: "single_select", options: yn("yellow") },
        { label: "Difficulty with Daily Activities", labelLocal: "रोज़मर्रा के काम में कठिनाई", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "excessive_thirst_assessment", label: "Excessive Thirst Assessment", triggers: ["excessive_thirst"],
      questions: [
        { label: "Associated Frequent Urination (Kasrat-ul-Baul)", labelLocal: "साथ में बार-बार पेशाब आना", type: "single_select", options: yn("yellow") },
        { label: "Unexplained Weight Loss (Dubul)", labelLocal: "अस्पष्ट वज़न घटना", type: "single_select", options: yn("yellow") },
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "More than 1 week", labelLocal: "1 हफ़्ते से ज़्यादा", flagSeverity: "yellow" }] },
      ],
    },
    {
      key: "insomnia_assessment", label: "Insomnia Assessment", triggers: ["insomnia"],
      questions: [
        { label: "Duration (Muddat-e-Sahar)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 1 week", labelLocal: "1 हफ़्ते से कम", flagSeverity: "green" }, { label: "1-4 weeks", labelLocal: "1-4 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 4 weeks", labelLocal: "4 हफ़्ते से ज़्यादा", flagSeverity: "red" }] },
        { label: "Associated Anxiety / Stress (Waswas)", labelLocal: "साथ में चिंता", type: "single_select", options: yn("yellow") },
        { label: "Daytime Functioning Affected", labelLocal: "दिन के काम पर असर", type: "single_select", options: yn("yellow") },
      ],
    },
    {
      key: "anxiety_assessment", label: "Anxiety / Stress Assessment", triggers: ["anxiety_stress"],
      questions: [
        { label: "Severity (Shiddat)", labelLocal: "गंभीरता", type: "single_select", options: mms() },
        { label: "Thoughts of Self-Harm", labelLocal: "खुद को नुकसान पहुँचाने के विचार", type: "single_select", options: yn("red") },
        { label: "How long has this been going on?", labelLocal: "यह कब से हो रहा है?", type: "text" },
      ],
    },
    {
      key: "low_mood_assessment", label: "Low Mood / Melancholia Assessment", triggers: ["low_mood"],
      questions: [
        { label: "Duration (Muddat)", labelLocal: "अवधि", type: "single_select", options: [{ label: "Less than 2 weeks", labelLocal: "2 हफ़्ते से कम", flagSeverity: "green" }, { label: "2-4 weeks", labelLocal: "2-4 हफ़्ते", flagSeverity: "yellow" }, { label: "More than 4 weeks", labelLocal: "4 हफ़्ते से ज़्यादा", flagSeverity: "red" }] },
        { label: "Loss of Interest in Activities", labelLocal: "काम-काज में रुचि कम होना", type: "single_select", options: yn("yellow") },
        { label: "Thoughts of Self-Harm", labelLocal: "खुद को नुकसान पहुँचाने के विचार", type: "single_select", options: yn("red") },
      ],
    },
    {
      key: "memory_weakness_assessment", label: "Memory Weakness Assessment", triggers: ["memory_weakness"],
      questions: [
        { label: "Onset (Shuru')", labelLocal: "शुरुआत", type: "single_select", options: [{ label: "Gradual", labelLocal: "धीरे-धीरे", flagSeverity: "green" }, { label: "Sudden", labelLocal: "अचानक", flagSeverity: "red" }] },
        { label: "Associated Confusion", labelLocal: "साथ में भ्रम की स्थिति", type: "single_select", options: yn("red") },
        { label: "Affecting Daily Life", labelLocal: "रोज़मर्रा के जीवन पर असर", type: "single_select", options: yn("yellow") },
      ],
    },
  ];

  for (let mi = 0; mi < modules.length; mi++) {
    const m = modules[mi];
    const existing = await db.screeningModule.findUnique({
      where: { key: m.key },
      select: { id: true, questions: { orderBy: { sortOrder: "asc" }, select: { id: true, options: { orderBy: { sortOrder: "asc" }, select: { id: true } } } } },
    });

    if (existing) {
      // Backfill the richer Unani/Hindi phrasing added later onto rows seeded
      // before it existed — positional match against the seed array. Safe
      // since this screening content has not yet been hand-edited by an
      // admin (same add-only spirit as the chief-complaint category backfill
      // above), and only label/labelLocal/instructionText are touched.
      for (let qi = 0; qi < m.questions.length && qi < existing.questions.length; qi++) {
        const q = m.questions[qi];
        const dbQ = existing.questions[qi];
        await db.screeningQuestion.update({
          where: { id: dbQ.id },
          data: { label: q.label, labelLocal: q.labelLocal || null, instructionText: q.instructionText || null },
        });
        if (q.options) {
          for (let oi = 0; oi < q.options.length && oi < dbQ.options.length; oi++) {
            await db.screeningOption.update({
              where: { id: dbQ.options[oi].id },
              data: { label: q.options[oi].label, labelLocal: q.options[oi].labelLocal || null },
            });
          }
        }
      }
      continue;
    }

    const module_ = await db.screeningModule.create({
      data: {
        key: m.key, label: m.label, sortOrder: mi,
        triggers: { create: m.triggers.map((ck) => ({ chiefComplaintId: complaintRows[ck].id })) },
      },
    });

    for (let qi = 0; qi < m.questions.length; qi++) {
      const q = m.questions[qi];
      await db.screeningQuestion.create({
        data: {
          moduleId: module_.id, label: q.label, labelLocal: q.labelLocal || null,
          instructionText: q.instructionText || null, type: q.type, sortOrder: qi,
          applicableGender: q.applicableGender || null,
          minAgeDays: q.minAgeDays ?? null, maxAgeDays: q.maxAgeDays ?? null,
          numericOperator: q.numericOperator || null, numericThreshold: q.numericThreshold ?? null, numericFlagSeverity: q.numericFlagSeverity || null,
          numericOperator2: q.numericOperator2 || null, numericThreshold2: q.numericThreshold2 ?? null, numericFlagSeverity2: q.numericFlagSeverity2 || null,
          options: q.options ? { create: q.options.map((o, oi) => ({ label: o.label, labelLocal: o.labelLocal || null, flagSeverity: o.flagSeverity || null, sortOrder: oi })) } : undefined,
        },
      });
    }
  }
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
