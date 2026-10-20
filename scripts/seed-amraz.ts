// Adds the drafted Amraz catalogue (unverified, for physician review in Admin). Safe to re-run: add-only by key.
import { seedAmraz } from "../src/lib/amraz";
import { db } from "../src/lib/db";

seedAmraz().then((n) => console.log(`Amraz catalogue: ${n} entries added`)).finally(() => db.$disconnect());
