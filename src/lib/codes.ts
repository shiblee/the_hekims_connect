import { db } from "@/lib/db";

// Same retry-loop convention as the Staff module's staffCode generator.
export async function nextPatientCode() {
  for (let i = 0; i < 5; i++) {
    const count = await db.patient.count();
    const code = `PT${count + 1 + i}`;
    const exists = await db.patient.findUnique({ where: { patientCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique patient code");
}

export async function nextVisitCode() {
  for (let i = 0; i < 5; i++) {
    const count = await db.visit.count();
    const code = `V${String(count + 1 + i).padStart(8, "0")}`;
    const exists = await db.visit.findUnique({ where: { visitCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique visit code");
}

export async function nextPaymentCode() {
  for (let i = 0; i < 5; i++) {
    const count = await db.payment.count();
    const code = `PAY${String(count + 1 + i).padStart(8, "0")}`;
    const exists = await db.payment.findUnique({ where: { paymentCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique payment code");
}
