import { db } from "../src/lib/db";
import { DEFAULT_EMAIL_TEMPLATES } from "../src/lib/notifications";

const SECTIONS: { key: string; label: string; options: string[] }[] = [
  {
    key: "facility_type",
    label: "Facility Type",
    options: ["Hospital", "Clinic", "Nursing Home", "Health Centre", "Other"],
  },
  {
    key: "specialization",
    label: "Specialization",
    options: [
      "General Medicine", "Pediatrics", "Obstetrics & Gynecology", "General Surgery", "Orthopedics",
      "Dermatology", "ENT", "Ophthalmology", "Dental", "Cardiology", "Neurology", "Psychiatry",
      "Pulmonology", "Nephrology", "Urology", "Gastroenterology", "Radiology", "Pathology",
      "Emergency Medicine", "Other",
    ],
  },
  {
    key: "service_diagnostic",
    label: "Diagnostic Services",
    options: ["Laboratory", "X-Ray", "Ultrasound", "CT Scan", "MRI"],
  },
  {
    key: "service_emergency",
    label: "Emergency Services",
    options: ["Emergency Department", "Ambulance", "24×7 Emergency"],
  },
  {
    key: "service_maternal_child",
    label: "Maternal & Child Health",
    options: ["ANC", "PNC", "Delivery", "C-Section", "Newborn Care", "Pediatric Care", "NICU", "SNCU", "KMC"],
  },
  {
    key: "service_other",
    label: "Other Services",
    options: ["Pharmacy", "Blood Bank", "Blood Storage", "ICU", "Operation Theatre"],
  },
];

const SETTINGS: { key: string; value: string }[] = [
  { key: "free_trial_months", value: "3" },
  { key: "paid_plan_price_per_month", value: "999" },
  { key: "currency", value: "INR" },
];

async function main() {
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    const existing = await db.metadataSection.findUnique({ where: { key: s.key } });
    if (existing) {
      console.log(`Skipping existing section: ${s.key}`);
      continue;
    }
    const section = await db.metadataSection.create({ data: { key: s.key, label: s.label, sortOrder: i } });
    await db.metadataOption.createMany({
      data: s.options.map((label, idx) => ({ sectionId: section.id, label, sortOrder: idx })),
    });
    console.log(`Seeded section ${s.key} with ${s.options.length} options`);
  }

  for (const setting of SETTINGS) {
    await db.portalSetting.upsert({
      where: { category_key: { category: "subscription", key: setting.key } },
      update: {},
      create: { category: "subscription", key: setting.key, value: setting.value },
    });
    console.log(`Ensured setting subscription.${setting.key} = ${setting.value}`);
  }

  const template = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === "facility_profile_completed");
  if (template) {
    const existingTemplate = await db.emailTemplate.findUnique({ where: { key: template.key } });
    if (!existingTemplate) {
      await db.emailTemplate.create({ data: template });
      console.log(`Created email template: ${template.key}`);
    } else {
      console.log(`Email template already exists: ${template.key}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
