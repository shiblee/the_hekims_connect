// One-off content migration: replaces the generic/allopathic-flavored Meta option lists
// seeded earlier with authentic Unani-only terminology. Safe to re-run (idempotent) —
// only touches the section keys listed here. See seedMetadata() in src/lib/seed.ts for
// the same content, which is what fresh installs get automatically; this script exists
// to retroactively apply the same correction to an already-seeded database.
import { db } from "../src/lib/db";

const UPDATED_SECTIONS: { key: string; label: string; options: string[] }[] = [
  {
    key: "specialization", label: "Specialization", options: [
      "Moalijat (General Medicine)", "Qabalat-o-Amraze Niswan (Gynaecology & Obstetrics)",
      "Amraze Atfal (Paediatrics)", "Jarahat (Surgery)", "Ilaj-bil-Tadbeer (Regimenal Therapy)",
      "Ilaj-bil-Ghiza (Dietotherapy)", "Amraze Jild wa Tazeeniyat (Dermatology & Cosmetology)",
      "Ain, Uzn, Anaf, Halaq (Eye, Ear, Nose & Throat)", "Kulliyat (Basic Principles of Unani Medicine)",
      "Tahaffuzi wa Samaji Tib (Preventive & Social Medicine)", "Ilmul Advia (Pharmacology)",
      "Munafeul Aza (Physiology)", "Other",
    ],
  },
  {
    key: "service_diagnostic", label: "Diagnostic & Examination Services", options: [
      "Nabz Shanasi (Pulse Diagnosis)", "Qarurat Mualaina (Urine Examination)",
      "Baraz Mualaina (Stool Examination)", "Mizaj Tashkhis (Temperament Diagnosis)", "Other",
    ],
  },
  {
    key: "service_maternal_child", label: "Qabalat-o-Amraze Niswan wa Atfal (Maternal & Child Health)", options: [
      "Qabalat (Delivery / Obstetric Care)", "Amraze Niswan (Gynaecological Care)",
      "Amraze Atfal (Paediatric Care)", "Ilaj-bil-Ghiza for Mother & Child", "Other",
    ],
  },
  {
    key: "service_other", label: "Other Unani Services", options: [
      "Dawakhana (Unani Pharmacy)", "Hijama (Cupping Therapy)", "Dalk (Massage Therapy)",
      "Hammam (Bath / Steam Therapy)", "Fasd (Venesection)", "Jarahat Theatre (Operation Theatre)", "Other",
    ],
  },
  { key: "staff_employee_type", label: "Employee Type", options: ["Hakim (Unani Physician)", "Nurse", "Counsellor", "ANM", "ASHA", "Data Entry Operator", "Other"] },
  {
    key: "staff_specialization", label: "Staff Specialization", options: [
      "Moalijat (General Medicine)", "Qabalat-o-Amraze Niswan (Gynaecology & Obstetrics)",
      "Amraze Atfal (Paediatrics)", "Jarahat (Surgery)", "Ilaj-bil-Tadbeer (Regimenal Therapy)",
      "Ilaj-bil-Ghiza (Dietotherapy)", "Amraze Jild wa Tazeeniyat (Dermatology & Cosmetology)",
      "Ain, Uzn, Anaf, Halaq (Eye, Ear, Nose & Throat)", "Kulliyat (Basic Principles of Unani Medicine)",
      "Tahaffuzi wa Samaji Tib (Preventive & Social Medicine)", "Ilmul Advia (Pharmacology)",
      "Munafeul Aza (Physiology)", "Other",
    ],
  },
  { key: "staff_qualification", label: "Staff Qualification", options: ["BUMS (Bachelor of Unani Medicine & Surgery)", "MD (Unani)", "Diploma in Unani Medicine (DUMS)", "B.Sc Nursing", "GNM", "ANM", "Other"] },
  { key: "staff_designation", label: "Staff Designation", options: ["Resident Hakim", "Senior Hakim", "Consultant Hakim", "Staff Nurse", "Senior Nurse", "Counsellor", "Data Entry Operator", "Receptionist", "Other"] },
  { key: "staff_role", label: "Staff Role", options: ["Hakim", "Staff Nurse", "Counsellor", "Administrator", "Support Staff", "Other"] },
  { key: "staff_responsibility", label: "Staff Responsibility", options: ["Patient Consultation", "Mizaj Assessment", "Ilaj-bil-Tadbeer", "Prescription Management", "Appointment Scheduling", "Patient Follow-up", "Front Desk", "Other"] },
];

async function main() {
  for (const s of UPDATED_SECTIONS) {
    const existing = await db.metadataSection.findUnique({ where: { key: s.key } });
    const section = await db.metadataSection.upsert({
      where: { key: s.key },
      update: { label: s.label },
      create: { key: s.key, label: s.label, sortOrder: 99 },
    });
    await db.metadataOption.deleteMany({ where: { sectionId: section.id } });
    await db.metadataOption.createMany({
      data: s.options.map((label, idx) => ({ sectionId: section.id, label, sortOrder: idx })),
    });
    console.log(`${existing ? "Updated" : "Created"} ${s.key}: ${s.options.length} options`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
