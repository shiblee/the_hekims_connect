// One-off: the new "diagnosis.signoff" permission (Stage 5 senior sign-off). Clinics that saved their own
// role permissions keep their customisation; roles there that can already diagnose AND prescribe (senior
// Hakims) get sign-off too, so finalising keeps working for them. Safe to re-run.
import { db } from "../src/lib/db";

async function main() {
  const rows = await db.staffRolePermission.findMany({ select: { id: true, role: true, permissions: true } });
  let n = 0;
  for (const r of rows) {
    let p: string[] = [];
    try { p = JSON.parse(r.permissions || "[]"); } catch { continue; }
    if (p.includes("diagnosis") && p.includes("prescribe") && !p.includes("diagnosis.signoff")) {
      await db.staffRolePermission.update({ where: { id: r.id }, data: { permissions: JSON.stringify([...p, "diagnosis.signoff"]) } });
      n++;
    }
  }
  console.log(`Sign-off permission added to ${n} saved role(s)`);
}
main().finally(() => db.$disconnect());
