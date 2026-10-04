// One-off backfill: assigns a permanent patientCode ("PT1234") to every
// existing Patient row created before the Patient Module added this field.
// Safe to re-run — only touches rows where patientCode is still null.
import { db } from "../src/lib/db";

async function main() {
  const patients = await db.patient.findMany({
    where: { patientCode: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let count = await db.patient.count({ where: { NOT: { patientCode: null } } });
  for (const p of patients) {
    count += 1;
    const patientCode = `PT${count}`;
    await db.patient.update({ where: { id: p.id }, data: { patientCode } });
  }

  console.log(`Backfilled ${patients.length} patient(s). Total with a code: ${count}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
