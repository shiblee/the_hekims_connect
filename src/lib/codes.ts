import { db } from "@/lib/db";

// Short running numbers — PT9, V6, PAY3 (no leading zeros). Same retry-loop convention as the staffCode generator.
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
    const code = `V${count + 1 + i}`;
    const exists = await db.visit.findUnique({ where: { visitCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique visit code");
}

export async function nextPaymentCode() {
  for (let i = 0; i < 5; i++) {
    const count = await db.payment.count();
    const code = `PAY${count + 1 + i}`;
    const exists = await db.payment.findUnique({ where: { paymentCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique payment code");
}
