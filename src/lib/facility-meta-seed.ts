// Enrichment for Admin → Meta → Facility (six sections). Unani first, open to integrated care.
// Add-only: existing options (matched by label, case-insensitive) are never changed, and each
// section's "Other" option is kept as the last item.

import type { PrismaClient } from "@prisma/client";

export const FACILITY_META: Record<string, string[]> = {
  facility_type: [
    "Unani Hospital", "Multi-speciality Hospital", "Teaching Hospital (Unani Medical College)", "Polyclinic",
    "Dawakhana / Dispensary", "Government Unani Dispensary", "Integrated AYUSH Centre", "Primary Health Centre (PHC)",
    "Community Health Centre (CHC)", "Wellness Centre", "Hijama & Regimenal Therapy Centre", "Day-care Centre",
    "Diagnostic Centre", "Research Institute", "Telemedicine / Online Practice", "Home-visit Practice",
  ],
  specialization: [
    "Amraze Qalb (Cardiology)", "Amraze Dimagh wa Asab (Neurology)", "Amraze Nafsiya (Psychiatry)",
    "Amraze Hazm (Gastroenterology)", "Amraze Kabid (Hepatology)", "Amraze Sadr wa Riya (Respiratory Medicine)",
    "Amraze Gurda wa Masana (Nephrology & Urology)", "Amraze Mafasil (Joint & Rheumatic Disorders)",
    "Amraze Ghudad (Endocrinology & Diabetes)", "Amraze Uyoon (Ophthalmology)", "Amraze Shaikhukhat (Geriatrics)",
    "Amraze Mardana (Men's Health)", "Ilmul Amraz (Pathology)", "Ilmul Saidla (Pharmacy)",
    "Tashreehul Badan (Anatomy)", "Tibb-e-Qanooni wa Ilmul Samoom (Forensic Medicine & Toxicology)",
    "Ilaj-bil-Dawa (Pharmacotherapy)", "Physiotherapy", "Yoga & Naturopathy", "Ayurveda", "Homoeopathy",
    "Allopathy (General Practice)", "Dentistry", "Nutrition & Dietetics",
  ],
  service_diagnostic: [
    "Mu'ayana-e-Lisan (Tongue Examination)", "Mu'ayana-e-Ain (Eye Examination)", "Mu'ayana-e-Jild (Skin Examination)",
    "Blood Pressure Monitoring", "BMI & Body Composition", "Blood Sugar (Random / Fasting)", "HbA1c",
    "Complete Blood Count (CBC)", "Lipid Profile", "Liver Function Test (LFT)", "Kidney Function Test (KFT)",
    "Thyroid Profile", "Uric Acid", "Vitamin D & B12", "Urine Routine", "Stool Routine", "Pregnancy Test",
    "ECG", "X-ray", "Ultrasound", "Spirometry", "Vision Testing", "Hearing Test (Audiometry)",
    "Pathology Lab", "Sample Collection Centre",
  ],
  service_emergency: [
    "Casualty / Trauma Care", "First Aid", "Minor Procedures & Dressing", "Oxygen Support", "Nebulisation",
    "IV Fluids", "Burns First Aid", "Snake & Scorpion Bite First Aid", "Poisoning First Aid & Referral",
    "Emergency Referral Tie-up with Hospital", "Night Duty Doctor", "On-call Doctor", "Patient Transport (non-emergency)",
  ],
  service_maternal_child: [
    "Antenatal Check-ups", "Postnatal Care", "Family Planning Counselling", "Uqr (Infertility Care)",
    "Amraze Tams (Menstrual Disorders)", "Sayalan-ur-Rahem (Leucorrhoea Care)", "PCOS Care", "Menopause Care",
    "Breastfeeding & Lactation Support", "Newborn Care", "Immunisation", "Growth & Nutrition Monitoring",
    "Child Development Assessment", "Adolescent Health", "Dalk for Infants (Baby Massage)",
  ],
  service_other: [
    "Takmeed (Fomentation)", "Nutool (Irrigation Therapy)", "Inkebab (Steam Inhalation)", "Riyazat (Exercise Therapy)",
    "Ishal (Purgation Therapy)", "Qai (Emesis Therapy)", "Idrar-e-Baul (Diuresis)", "Tareeq (Diaphoresis)",
    "Huqna (Enema Therapy)", "Zimad (Paste Application)", "Tila / Tadheen (Oil Application)", "Pashoya (Foot Bath)",
    "Abzan (Sitz Bath)", "Taleeq / Irsal-e-Alaq (Leech Therapy)", "Kai (Cauterisation)", "Dry Hijama", "Wet Hijama",
    "Ilaj-bil-Ghiza Diet Counselling", "Compounding of Unani Formulations", "Pharmacy Home Delivery",
    "Tele-consultation", "Home Visits", "Health Camps", "Yoga Sessions", "Counselling",
  ],
};

const norm = (s: string) => s.trim().toLowerCase();

/** Adds missing options; returns how many were added per section. */
export async function seedFacilityMeta(db: PrismaClient, opts: { dryRun?: boolean } = {}) {
  const out: Record<string, number> = {};
  for (const [key, labels] of Object.entries(FACILITY_META)) {
    const section = await db.metadataSection.findFirst({ where: { key }, include: { options: { orderBy: { sortOrder: "asc" } } } });
    if (!section) { out[key] = -1; continue; }
    const have = new Set(section.options.map((o) => norm(o.label)));
    const add = labels.filter((l) => !have.has(norm(l)) && have.add(norm(l)));
    out[key] = add.length;
    if (opts.dryRun || !add.length) continue;
    const other = section.options.find((o) => norm(o.label) === "other");
    let order = Math.max(-1, ...section.options.filter((o) => o !== other).map((o) => o.sortOrder)) + 1;
    for (const label of add) await db.metadataOption.create({ data: { sectionId: section.id, label, sortOrder: order++ } });
    if (other) await db.metadataOption.update({ where: { id: other.id }, data: { sortOrder: order } });
  }
  return out;
}
