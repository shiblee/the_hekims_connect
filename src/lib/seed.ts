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

export async function seedDatabase() {
  await seedTranslations();
  await seedPages();

  // Check if already seeded
  const hakimCount = await db.hakim.count();
  if (hakimCount > 0) return false;

  await db.admin.create({
    data: {
      name: "Site Administrator",
      email: "admin@hekims.connect",
      password: hashPassword("admin12345"),
    },
  });

  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }

  const defaultSettings = [
    { category: "general", key: "portal_name", value: "The Hekim's Connect" },
    { category: "general", key: "support_email", value: "care@hekims.connect" },
    { category: "general", key: "support_phone", value: "+91 98765 43210" },
    { category: "registration", key: "hakim_registration_enabled", value: "true" },
    { category: "registration", key: "patient_registration_enabled", value: "true" },
    { category: "registration", key: "require_license_for_hakim", value: "false" },
    { category: "verification", key: "otp_expiry_minutes", value: "10" },
    { category: "verification", key: "otp_resend_cooldown_seconds", value: "30" },
    { category: "verification", key: "max_otp_attempts", value: "5" },
    { category: "verification", key: "max_login_attempts", value: "5" },
    { category: "verification", key: "lockout_duration_minutes", value: "15" },
  ];
  for (const s of defaultSettings) {
    await db.portalSetting.upsert({
      where: { category_key: { category: s.category, key: s.key } },
      update: {},
      create: s,
    });
  }

  const hakimPassword = hashPassword("hekim123");

  const drColter = await db.hakim.create({
    data: {
      name: "Dr. Aliam Colter",
      email: "colter@hekims.connect",
      phone: "9876543210",
      password: hakimPassword,
      license: "UNI-2017-0432",
      specialization: "Senior Unani Specialist",
      experience: 8,
      mizaj: "Safrawi",
      rating: 4.9,
      bio: "Practicing Hakim specialising in Mizaj balance, Regimental therapy (Hijama, Dalk) and chronic disease management through classical Unani formulations.",
      avatarColor: "teal",
      verified: true,
    },
  });

  const drKhan = await db.hakim.create({
    data: {
      name: "Dr. Maira Khan",
      email: "khan@hekims.connect",
      phone: "9876543211",
      password: hakimPassword,
      license: "UNI-2019-0511",
      specialization: "Unani Dietotherapy",
      experience: 6,
      mizaj: "Balghami",
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
        hakimId: drColter.id,
        patientId: mark.id,
        date: today,
        time: "08:00",
        type: "Chronic Pain Consultation",
        reason: "Back pain flare-up",
        status: "scheduled",
      },
      {
        hakimId: drColter.id,
        patientId: alexa.id,
        date: today,
        time: "09:30",
        type: "Mizaj Assessment Review",
        reason: "Knee pain, Safra imbalance",
        status: "scheduled",
      },
      {
        hakimId: drColter.id,
        patientId: brick.id,
        date: today,
        time: "12:30",
        type: "Pharmacy Refill Check",
        reason: "Khamira Marwarid refill",
        status: "scheduled",
      },
      {
        hakimId: drKhan.id,
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
        receiverId: drColter.id,
        receiverType: "hakim",
        content: "Hi, Doctor. My knee hurts again.",
      },
      {
        senderId: alexa.id,
        senderType: "patient",
        receiverId: drColter.id,
        receiverType: "hakim",
        content: "Should I increase the dose of the herbal balm?",
      },
      {
        senderId: drColter.id,
        senderType: "hakim",
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
      hakimId: drColter.id,
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
      hakimId: drColter.id,
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
