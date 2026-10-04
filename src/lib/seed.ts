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
    { key: "staff_employee_type", label: "Employee Type", category: "Staff", options: ["Hakim (Unani Physician)", "Nurse", "Counsellor", "ANM", "ASHA", "Data Entry Operator", "Other"] },
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
    const existingOptions = await db.metadataOption.count({ where: { sectionId: section.id } });
    if (existingOptions === 0) {
      await db.metadataOption.createMany({
        data: s.options.map((label, idx) => ({ sectionId: section.id, label, sortOrder: idx })),
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

export async function seedEmailTemplates() {
  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
}

export async function seedDatabase() {
  await seedTranslations();
  await seedPages();
  await seedMetadata();
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
