// Enrichment for Admin → Meta → Staff (six sections). Unani first, open to integrated care
// and every kind of clinic worker. Add-only: existing options are never changed or removed.
// New Staff Roles also need default permissions — see ROLE_DEFAULTS in staff-permissions.ts.

import type { PrismaClient } from "@prisma/client";
import { seedMetaOptions } from "@/lib/facility-meta-seed";

export const STAFF_META: Record<string, string[]> = {
  staff_employee_type: [
    "Junior Hakim / Intern", "Visiting Hakim (Consultant)", "Regimenal Therapist (Ilaj-bil-Tadbeer)", "Hijama Therapist",
    "Pharmacist", "Dawasaz (Unani Compounder)", "Lab Technician", "Radiographer / X-ray Technician", "Physiotherapist",
    "Dietitian / Nutritionist", "Yoga Instructor", "Allopathic Doctor (MBBS)", "Dentist", "Midwife",
    "Multi-Purpose Health Worker (MPW)", "Receptionist", "Accountant", "Clinic Manager", "Medical Records Clerk",
    "Store Keeper", "Ward Attendant", "Housekeeping Staff", "Ambulance Driver", "Security Guard", "IT Support",
  ],
  // Specializations also copy everything in Meta → Facility → Specializations (added at run time).
  staff_specialization: [
    "Ilaj-bil-Dawa (Pharmacotherapy)", "Ilaj-bil-Yad (Surgery & Manual Procedures)", "Hijama (Cupping Therapy)",
    "Amraze Mafasil (Joint & Rheumatic Disorders)", "Amraze Nafsiya (Psychiatry)", "Amraze Qalb (Cardiology)",
    "Amraze Dimagh wa Asab (Neurology)", "Amraze Hazm (Gastroenterology)", "Amraze Ghudad (Endocrinology & Diabetes)",
    "Ilmul Saidla (Pharmacy)", "Ilmul Amraz (Pathology)", "Nursing Care", "Community Health", "Physiotherapy",
    "Nutrition & Dietetics", "Yoga & Naturopathy", "Counselling & Psychology", "Hospital Administration",
  ],
  staff_qualification: [
    "MS (Unani)", "PhD (Unani)", "PG Diploma (Unani)", "D.Pharm (Unani)", "Certificate in Hijama / Regimenal Therapy",
    "B.Pharm", "D.Pharm", "MBBS", "MD / MS (Allopathy)", "BAMS", "BHMS", "BDS", "BNYS", "BPT (Physiotherapy)", "MPT",
    "M.Sc Nursing", "Post Basic B.Sc Nursing", "DMLT (Medical Lab Technology)", "BMLT", "B.Sc Radiology / Radiography",
    "B.Sc / M.Sc Nutrition & Dietetics", "Diploma in Yoga", "M.A. / M.Sc Psychology", "PG Diploma in Counselling",
    "MBA / Diploma (Hospital Administration)", "B.Com / BBA", "Graduate (any discipline)", "Computer Certificate (DCA / CCC)",
    "First Aid Certificate", "12th Pass", "10th Pass",
  ],
  staff_designation: [
    "Chief Medical Officer", "Medical Superintendent", "Head of Department", "Junior Resident", "Intern Hakim",
    "Visiting Hakim", "Regimenal Therapist", "Hijama Therapist", "Chief Pharmacist", "Pharmacist", "Dawasaz (Compounder)",
    "Lab Technician", "Physiotherapist", "Dietitian", "Nursing Superintendent", "Ward Sister / Nurse In-charge", "ANM",
    "Midwife", "Clinic Manager", "Administrative Officer", "Accountant", "Cashier", "Front Desk Executive",
    "Patient Coordinator", "Medical Records Officer", "Store Keeper", "Ward Attendant", "Housekeeping Supervisor",
    "Ambulance Driver", "Security Guard", "IT Executive", "Yoga Instructor",
  ],
  staff_role: [
    "Clinic Manager", "Junior Hakim / Intern", "Receptionist", "Cashier / Accounts", "Pharmacist", "Lab Technician",
    "Regimenal Therapist", "Dietitian", "Physiotherapist", "Data Entry Operator",
  ],
  staff_responsibility: [
    "Patient Registration", "Vitals Recording", "Triage & Emergency Screening", "Lifestyle Assessment (Asbab-e-Sitta)",
    "Diagnosis (Tashkhees)", "Treatment Planning (Usool-e-Ilaj)", "Diet Counselling (Ilaj-bil-Ghiza)", "Hijama (Cupping)",
    "Dalk (Massage Therapy)", "Fasd / Taleeq Procedures", "Referrals", "Patient Counselling", "Health Education",
    "Home Visits", "Tele-consultation", "Health Camps", "Medicine Dispensing", "Unani Compounding (Dawasazi)",
    "Pharmacy Stock Management", "Lab Sample Collection", "Lab & Imaging Reports", "Reports & Records Management",
    "Billing & Payments", "Cash Handling & Day Closing", "Refunds & Cancellations", "Messages & Patient Communication",
    "Inventory & Store", "Housekeeping & Hygiene", "Infection Control", "Biomedical Waste Management", "Ambulance Duty",
    "Data Entry", "Staff Management", "Clinic Administration", "Quality & Compliance",
  ],
};

export async function seedStaffMeta(db: PrismaClient, opts: { dryRun?: boolean } = {}) {
  const facilitySpecs = await db.metadataOption.findMany({ where: { section: { key: "specialization" } }, select: { label: true } });
  const map = {
    ...STAFF_META,
    staff_specialization: [...facilitySpecs.map((o) => o.label).filter((l) => l.trim().toLowerCase() !== "other"), ...STAFF_META.staff_specialization],
  };
  return seedMetaOptions(db, map, opts);
}
