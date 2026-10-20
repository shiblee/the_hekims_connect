// Adds any starter tours and tutorials that don't exist yet (by module + name). Never overwrites admin edits. Safe to re-run.
import { db } from "../src/lib/db";
import { seedStarterGuidance } from "../src/lib/guidance/starter-seed";

seedStarterGuidance(db).then((r) => console.log(`Guidance: ${r.tours} tour(s), ${r.docs} tutorial(s) added`)).finally(() => db.$disconnect());
