// Ghiza (foods) database for Ilaj-bil-Ghiza. Each food has its classical Unani
// temperament (quality + degree), a food group, the conditions it suits or
// should be avoided in, allergens, and a Wikipedia title from which a real,
// freely-licensed photo is fetched (credit and licence are stored with it).
// Existing foods stay approved and only gain these details; new foods are
// DRAFTS until a physician reviews them in Admin → Tashkhees & Ilaj → Ghiza.
// Temperaments follow common Unani attributions and are part of that review.

import type { ConditionKey } from "@/lib/ghiza-conditions";

export interface FoodSide { symptoms?: string[]; conditions?: ConditionKey[]; categories?: string[]; organs?: string[] }
export interface GhizaRule { good?: FoodSide; avoid?: FoodSide; allergens?: string[]; heavy?: boolean; nafakh?: boolean }
export interface FoodSeed { label: string; category: string; mizaj: string; description: string; wiki: string; rule: GhizaRule }

const G = "Grains & breads", P = "Pulses", V = "Vegetables", L = "Leafy greens & herbs", F = "Fruits", N = "Dry fruits, nuts & seeds",
  D = "Dairy", M = "Meat, fish & eggs", S = "Spices", O = "Oils & fats", SW = "Sweeteners", DR = "Drinks", PF = "Prepared foods";

const f = (label: string, category: string, mizaj: string, description: string, wiki: string, rule: GhizaRule = {}): FoodSeed => ({ label, category, mizaj, description, wiki, rule });

/** Details for the foods already in the list (matched by label). */
export const EXISTING_FOODS: FoodSeed[] = [
  f("Barley water (Ma-ush-Shaeer)", DR, "Barid-Ratab 1", "Cold & moist — cooling, light", "Barley water", { good: { symptoms: ["burning", "heat", "fever", "urin", "thirst"], conditions: ["kidney_stones", "hypertension", "cholesterol"] } }),
  f("Cucumber (Khiyar)", V, "Barid-Ratab 2", "Cold & moist", "Cucumber", { good: { symptoms: ["burning", "heat", "thirst", "urin"], conditions: ["hypertension", "diabetes", "obesity"] }, avoid: { symptoms: ["cough", "phlegm", "joint"], conditions: ["asthma"] } }),
  f("Bottle gourd (Kaddu / Lauki)", V, "Barid-Ratab 1", "Cold & moist — easily digested", "Calabash", { good: { symptoms: ["burning", "heat", "constipat", "acid", "palpitation"], conditions: ["hypertension", "heart", "acidity", "obesity"] } }),
  f("Pomegranate (Anar)", F, "Barid-Yabis 1", "Cold — astringent, cools bile", "Pomegranate", { good: { symptoms: ["nausea", "vomit", "loose", "diarr", "burning", "pale", "weak"], conditions: ["anaemia", "heart", "acidity"] } }),
  f("Watermelon (Tarbuz)", F, "Barid-Ratab 2", "Cold & moist", "Watermelon", { good: { symptoms: ["burning", "heat", "urin", "thirst"], conditions: ["hypertension"] }, avoid: { symptoms: ["cough", "phlegm", "loose", "diarr"], conditions: ["diabetes", "asthma"] } }),
  f("Yoghurt (Dahi)", D, "Barid-Ratab 2", "Cold & moist", "Yogurt", { good: { symptoms: ["loose", "diarr", "burning", "acid"] }, avoid: { symptoms: ["cough", "phlegm", "joint", "sore throat"], conditions: ["asthma", "arthritis"] }, allergens: ["Milk & Dairy"] }),
  f("Milk (Laban)", D, "Barid-Ratab 1", "Moist, nourishing", "Milk", { good: { symptoms: ["weak", "fatigue", "dry", "weight loss", "acid"], conditions: ["acidity"] }, avoid: { symptoms: ["loose", "diarr", "bloat", "gas", "phlegm"], conditions: ["ibs"] }, allergens: ["Milk & Dairy"], heavy: true }),
  f("Green gram (Moong dal)", P, "Barid-Yabis 1", "Light, balanced", "Mung bean", { good: { symptoms: ["fever", "weak", "indigestion", "loose", "diarr"], conditions: ["diabetes", "obesity", "liver", "cholesterol"] } }),
  f("Mutton broth (Yakhni)", M, "Haar-Ratab 1", "Hot & moist — restorative", "Yakhni", { good: { symptoms: ["weak", "fatigue", "weight loss", "cold", "joint"], conditions: ["anaemia"] }, avoid: { symptoms: ["burning", "heat", "fever"], conditions: ["gout", "cholesterol", "heart"] } }),
  f("Honey (Asal)", SW, "Haar-Yabis 2", "Hot & dry", "Honey", { good: { symptoms: ["cough", "phlegm", "sore throat", "weak", "cold"], conditions: ["asthma"] }, avoid: { symptoms: ["burning", "heat"], conditions: ["diabetes"] }, allergens: ["Honey"] }),
  f("Dates (Khurma)", F, "Haar-Ratab 2", "Hot & moist", "Date palm", { good: { symptoms: ["weak", "fatigue", "pale", "weight loss", "constipat"], conditions: ["anaemia"] }, avoid: { symptoms: ["burning", "heat"], conditions: ["diabetes", "obesity"] } }),
  f("Ginger (Zanjabeel)", S, "Haar-Yabis 2", "Hot & dry — carminative", "Ginger", { good: { symptoms: ["bloat", "gas", "indigestion", "nausea", "cough", "phlegm", "cold", "joint"], conditions: ["arthritis", "asthma"] }, avoid: { symptoms: ["burning", "heat", "acid", "ulcer", "bleeding"], conditions: ["acidity", "piles"] }, allergens: ["Ginger"] }),
  f("Garlic (Seer)", S, "Haar-Yabis 3", "Hot & dry", "Garlic", { good: { symptoms: ["cough", "phlegm", "joint", "cold"], conditions: ["cholesterol", "hypertension", "heart", "arthritis"] }, avoid: { symptoms: ["burning", "heat", "acid", "bleeding"], conditions: ["acidity", "piles"] }, allergens: ["Garlic"] }),
  f("Red chilli & black pepper", S, "Haar-Yabis 3", "Hot & dry — heating", "Chili pepper", { avoid: { symptoms: ["burning", "heat", "acid", "ulcer", "itch", "rash", "bleeding", "loose"], conditions: ["acidity", "piles", "ibs", "skin", "hypertension"] } }),
  f("Fried & fatty food", PF, "Haar-Ratab 2", "Heavy, heating", "Deep frying", { avoid: { symptoms: ["indigestion", "bloat", "acid", "nausea", "weight gain", "itch"], conditions: ["cholesterol", "heart", "obesity", "liver", "acidity", "diabetes", "skin"] }, heavy: true }),
  f("Black tea & coffee", DR, "Haar-Yabis 2", "Hot & dry, dehydrating", "Coffee", { avoid: { symptoms: ["acid", "burning", "anxi", "palpitation", "sleep", "insomnia", "constipat"], conditions: ["acidity", "hypertension", "heart"] } }),
  f("Sour citrus & vinegar", F, "Barid-Yabis 2", "Cold & dry, sharp", "Lemon", { good: { symptoms: ["nausea", "indigestion"], conditions: ["obesity", "liver"] }, avoid: { symptoms: ["acid", "ulcer", "cough", "joint", "sore throat"], conditions: ["acidity", "arthritis", "asthma"] }, allergens: ["Citrus Fruits"] }),
  f("Brinjal (Badinjan)", V, "Haar-Yabis 2", "Hot & dry — produces Sauda", "Eggplant", { avoid: { symptoms: ["itch", "rash", "dry skin", "joint", "low mood", "piles"], conditions: ["skin", "piles", "arthritis", "gout"] } }),
  f("Beef (Laham-e-Baqar)", M, "Barid-Yabis 2", "Heavy — produces Sauda", "Beef", { avoid: { symptoms: ["joint", "itch", "dry skin", "low mood", "indigestion"], conditions: ["gout", "cholesterol", "heart", "skin", "arthritis", "kidney"] }, heavy: true }),
  f("Rice (Aruz)", G, "Barid-Ratab 1", "Cold & moist", "Rice", { good: { symptoms: ["loose", "diarr", "burning", "heat"] }, avoid: { symptoms: ["cough", "phlegm", "weight gain"], conditions: ["diabetes", "obesity", "asthma"] } }),
  f("Cold & iced drinks", DR, "Barid-Ratab 3", "Cold — weakens digestion", "Iced tea", { avoid: { symptoms: ["cough", "phlegm", "sore throat", "indigestion", "joint", "bloat", "painful periods"], conditions: ["asthma", "arthritis", "ibs"] } }),
];

/** New foods — drafts until reviewed. */
export const NEW_FOODS: FoodSeed[] = [
  // Grains & breads
  f("Wheat (Gandum)", G, "Haar-Ratab 1", "Nourishing staple; whole-wheat chapati is light", "Wheat", { good: { symptoms: ["weak", "weight loss"] }, allergens: ["Wheat / Gluten"] }),
  f("Barley (Jau / Shaeer)", G, "Barid-Yabis 1", "Cooling, light; lowers heat and lipids", "Barley", { good: { symptoms: ["burning", "heat", "fever", "urin"], conditions: ["diabetes", "cholesterol", "kidney_stones", "hypertension", "obesity"] }, allergens: ["Wheat / Gluten"] }),
  f("Oats (Jai)", G, "Haar-Ratab 1", "Soft fibre; eases the bowel", "Oat", { good: { symptoms: ["constipat", "weak"], conditions: ["cholesterol", "diabetes", "heart", "constipation"] } }),
  f("Pearl millet (Bajra)", G, "Haar-Yabis 2", "Warming; heavy for weak digestion", "Pearl millet", { good: { symptoms: ["cold"], conditions: ["diabetes", "anaemia"] }, avoid: { symptoms: ["burning", "heat", "acid", "constipat"], conditions: ["acidity", "piles"] } }),
  f("Sorghum (Jowar)", G, "Barid-Yabis 1", "Light, gluten-free", "Sorghum", { good: { conditions: ["diabetes", "obesity"] }, avoid: { symptoms: ["constipat", "bloat"] } }),
  f("Maize (Makka)", G, "Haar-Yabis 1", "Coarse; produces wind in some", "Maize", { avoid: { symptoms: ["bloat", "gas", "indigestion"], conditions: ["ibs"] }, nafakh: true }),
  f("Semolina (Suji)", G, "Haar-Ratab 1", "Light porridge base for convalescence", "Semolina", { good: { symptoms: ["weak", "fever"] }, allergens: ["Wheat / Gluten"] }),
  f("Refined flour (Maida)", G, "Haar-Ratab 1", "Heavy, constipating; low fibre", "Flour", { avoid: { symptoms: ["constipat", "indigestion", "weight gain"], conditions: ["diabetes", "obesity", "constipation", "piles"] }, heavy: true, allergens: ["Wheat / Gluten"] }),
  f("Broken wheat porridge (Daliya)", G, "Haar-Ratab 1", "Light, nourishing, eases the bowel", "Bulgur", { good: { symptoms: ["constipat", "weak", "fever"], conditions: ["diabetes", "constipation"] }, allergens: ["Wheat / Gluten"] }),
  f("Talbina (barley porridge)", G, "Barid-Ratab 1", "Soothing barley-milk porridge; calms the heart and grief", "Talbina", { good: { symptoms: ["low mood", "anxi", "weak", "palpitation", "burning"], conditions: ["heart", "cholesterol"] } }),

  // Pulses
  f("Red lentil (Masoor)", P, "Barid-Yabis 2", "Dry; produces Sauda in excess", "Lentil", { good: { symptoms: ["loose", "diarr"] }, avoid: { symptoms: ["dry skin", "itch", "low mood", "constipat"], conditions: ["skin"] } }),
  f("Chickpea (Chana / Nakhud)", P, "Haar-Ratab 1", "Nourishing; causes wind", "Chickpea", { good: { symptoms: ["weak", "weight loss"], conditions: ["anaemia"] }, avoid: { symptoms: ["bloat", "gas", "indigestion"], conditions: ["ibs", "gout"] }, nafakh: true }),
  f("Black gram (Urad / Mash)", P, "Haar-Ratab 2", "Heavy, strengthening; causes wind", "Vigna mungo", { good: { symptoms: ["weak", "weight loss"] }, avoid: { symptoms: ["bloat", "gas", "indigestion", "joint"], conditions: ["gout", "ibs", "obesity", "arthritis"] }, heavy: true, nafakh: true }),
  f("Kidney beans (Rajma)", P, "Haar-Yabis 1", "Heavy and gas-forming", "Kidney bean", { avoid: { symptoms: ["bloat", "gas", "indigestion", "joint"], conditions: ["gout", "ibs"] }, heavy: true, nafakh: true }),
  f("Pigeon pea (Arhar / Toor)", P, "Barid-Yabis 1", "Everyday dal; moderately light", "Pigeon pea", {}),
  f("Khichdi (rice & moong)", PF, "Barid-Ratab 1", "Light convalescent meal", "Khichdi", { good: { symptoms: ["fever", "weak", "loose", "diarr", "indigestion", "nausea", "vomit"], conditions: ["ibs", "liver"] } }),

  // Vegetables
  f("Pumpkin (Kaddu / Qara)", V, "Barid-Ratab 2", "Cooling, soothing, easily digested", "Pumpkin", { good: { symptoms: ["burning", "heat", "constipat", "urin"], conditions: ["hypertension", "acidity"] }, avoid: { symptoms: ["cough", "phlegm"] } }),
  f("Ridge gourd (Tori)", V, "Barid-Ratab 1", "Light, cooling", "Luffa acutangula", { good: { symptoms: ["burning", "heat", "constipat"], conditions: ["diabetes", "piles"] } }),
  f("Round gourd (Tinda)", V, "Barid-Ratab 1", "Light, cooling", "Praecitrullus fistulosus", { good: { symptoms: ["burning", "urin"], conditions: ["kidney_stones"] } }),
  f("Bitter gourd (Karela)", V, "Haar-Yabis 2", "Bitter; lowers sugar, purifies blood", "Momordica charantia", { good: { symptoms: ["itch", "rash"], conditions: ["diabetes", "skin", "liver", "obesity"] }, avoid: { symptoms: ["weak", "dry skin"] } }),
  f("Spinach (Palak / Isfanakh)", L, "Barid-Ratab 1", "Laxative; rich in iron", "Spinach", { good: { symptoms: ["constipat", "pale", "weak"], conditions: ["anaemia", "constipation"] }, avoid: { symptoms: ["joint"], conditions: ["kidney_stones", "gout"] } }),
  f("Fenugreek leaves (Methi)", L, "Haar-Yabis 2", "Bitter, warming; lowers sugar", "Fenugreek", { good: { symptoms: ["joint", "bloat"], conditions: ["diabetes", "cholesterol", "arthritis"] }, avoid: { symptoms: ["burning", "heat", "bleeding"] }, allergens: ["Fenugreek"] }),
  f("Carrot (Gajar / Jazar)", V, "Haar-Ratab 1", "Nourishing; good for eyes and blood", "Carrot", { good: { symptoms: ["weak", "pale"], conditions: ["anaemia"] } }),
  f("Radish (Mooli / Fujl)", V, "Haar-Yabis 2", "Digestive but gas-forming; diuretic", "Radish", { good: { symptoms: ["urin"], conditions: ["kidney_stones", "liver"] }, avoid: { symptoms: ["bloat", "gas", "acid"], conditions: ["acidity", "ibs"] }, nafakh: true }),
  f("Turnip (Shalgham)", V, "Haar-Ratab 2", "Nourishing; warming in winter", "Turnip", { good: { symptoms: ["weak", "cough"], conditions: ["asthma"] }, nafakh: true }),
  f("Beetroot (Chuqandar)", V, "Haar-Yabis 1", "Builds blood", "Beetroot", { good: { symptoms: ["pale", "weak"], conditions: ["anaemia", "liver"] }, avoid: { conditions: ["kidney_stones", "diabetes"] } }),
  f("Potato (Aloo)", V, "Barid-Ratab 1", "Starchy, heavy; produces wind", "Potato", { good: { symptoms: ["weight loss"] }, avoid: { symptoms: ["bloat", "gas", "weight gain", "joint"], conditions: ["diabetes", "obesity", "arthritis"] }, heavy: true, nafakh: true }),
  f("Sweet potato (Shakarqandi)", V, "Haar-Ratab 1", "Nourishing, sweet", "Sweet potato", { good: { symptoms: ["weak", "constipat"] }, avoid: { conditions: ["diabetes"] } }),
  f("Onion (Piyaz / Basal)", V, "Haar-Ratab 3", "Hot; appetiser, thins phlegm", "Onion", { good: { symptoms: ["cough", "phlegm", "appetite"], conditions: ["cholesterol"] }, avoid: { symptoms: ["acid", "burning", "headache"], conditions: ["acidity", "migraine"] } }),
  f("Tomato (Tamatar)", V, "Barid-Ratab 1", "Sour; appetiser", "Tomato", { avoid: { symptoms: ["acid", "joint", "burning on passing urine"], conditions: ["acidity", "kidney_stones", "gout", "arthritis"] } }),
  f("Cabbage (Karam kalla)", V, "Barid-Yabis 1", "Gas-forming; produces Sauda", "Cabbage", { avoid: { symptoms: ["bloat", "gas", "low mood"], conditions: ["thyroid_low", "ibs"] }, nafakh: true }),
  f("Cauliflower (Phool gobhi)", V, "Barid-Yabis 1", "Gas-forming", "Cauliflower", { avoid: { symptoms: ["bloat", "gas", "joint"], conditions: ["thyroid_low", "gout", "ibs"] }, nafakh: true }),
  f("Okra (Bhindi)", V, "Barid-Ratab 1", "Mucilaginous; eases the bowel", "Okra", { good: { symptoms: ["constipat"], conditions: ["diabetes", "constipation"] }, avoid: { conditions: ["kidney_stones"] } }),
  f("Green peas (Matar)", V, "Barid-Ratab 1", "Gas-forming", "Pea", { avoid: { symptoms: ["bloat", "gas", "joint"], conditions: ["gout", "ibs"] }, nafakh: true }),
  f("Lettuce (Kahu)", L, "Barid-Ratab 2", "Cooling; calms and brings sleep", "Lettuce", { good: { symptoms: ["sleep", "insomnia", "anxi", "burning", "heat"] }, avoid: { symptoms: ["cough", "phlegm"] } }),
  f("Coriander leaves (Kishneez-e-Sabz)", L, "Barid-Yabis 1", "Cooling, aromatic; settles the stomach", "Coriander", { good: { symptoms: ["burning", "nausea", "acid", "palpitation"], conditions: ["acidity"] }, allergens: ["Coriander"] }),
  f("Mint (Pudina)", L, "Haar-Yabis 2", "Carminative; relieves nausea and wind", "Mentha", { good: { symptoms: ["nausea", "vomit", "bloat", "gas", "indigestion"] }, avoid: { conditions: ["acidity"] }, allergens: ["Mint"] }),
  f("Purslane (Khurfa)", L, "Barid-Ratab 3", "Strongly cooling; settles heat and bleeding", "Portulaca oleracea", { good: { symptoms: ["burning", "heat", "bleeding", "urin"], conditions: ["piles"] }, avoid: { conditions: ["kidney_stones"] } }),
  f("Bathua (Chenopodium)", L, "Haar-Yabis 1", "Mild laxative leafy green", "Chenopodium album", { good: { symptoms: ["constipat"], conditions: ["constipation", "piles", "liver"] }, avoid: { conditions: ["kidney_stones"] } }),
  f("Mushroom (Kumbhi)", V, "Barid-Ratab 2", "Heavy, cold", "Edible mushroom", { avoid: { symptoms: ["indigestion", "joint"], conditions: ["gout"] }, heavy: true }),
  f("Drumstick (Sahjan)", V, "Haar-Yabis 2", "Warming; for joints and blood", "Moringa oleifera", { good: { symptoms: ["joint", "pale", "weak"], conditions: ["arthritis", "anaemia", "diabetes"] }, avoid: { symptoms: ["burning", "bleeding"] } }),

  // Fruits
  f("Apple (Saib / Tuffah)", F, "Barid-Ratab 1", "Strengthens the heart and brain; gentle", "Apple", { good: { symptoms: ["palpitation", "weak", "loose", "constipat", "anxi"], conditions: ["heart", "cholesterol", "diabetes"] } }),
  f("Banana (Kela / Mauz)", F, "Haar-Ratab 1", "Nourishing but heavy", "Banana", { good: { symptoms: ["loose", "diarr", "weak", "cramp"] }, avoid: { symptoms: ["cough", "phlegm", "constipat"], conditions: ["diabetes", "asthma", "obesity"] }, heavy: true }),
  f("Mango (Aam / Anbah)", F, "Haar-Ratab 2", "Ripe: nourishing and warming", "Mango", { good: { symptoms: ["weak", "weight loss"] }, avoid: { symptoms: ["boil", "pimple", "itch", "loose"], conditions: ["diabetes", "skin", "obesity"] } }),
  f("Grapes (Angoor / Inab)", F, "Haar-Ratab 1", "Nourishing; eases the bowel", "Grape", { good: { symptoms: ["constipat", "weak", "dry"], conditions: ["constipation", "anaemia"] }, avoid: { symptoms: ["cough", "loose"], conditions: ["diabetes"] } }),
  f("Muskmelon (Kharbuza / Bitteekh)", F, "Haar-Ratab 1", "Diuretic; light", "Cantaloupe", { good: { symptoms: ["urin", "constipat"], conditions: ["kidney_stones"] }, avoid: { symptoms: ["loose", "cough"], conditions: ["diabetes"] } }),
  f("Guava (Amrood)", F, "Barid-Yabis 1", "Fibre-rich; constipating if unripe", "Guava", { good: { conditions: ["diabetes", "constipation"] }, avoid: { symptoms: ["cough", "phlegm"] } }),
  f("Papaya (Papita)", F, "Haar-Ratab 1", "Digestive, laxative", "Papaya", { good: { symptoms: ["constipat", "indigestion"], conditions: ["constipation", "liver", "piles"] }, avoid: { symptoms: ["heavy periods", "bleeding"] } }),
  f("Sweet orange (Narangi / Malta)", F, "Barid-Ratab 1", "Cooling, thirst-quenching", "Orange (fruit)", { good: { symptoms: ["burning", "heat", "fever", "thirst"] }, avoid: { symptoms: ["cough", "sore throat", "acid"], conditions: ["acidity"] }, allergens: ["Citrus Fruits"] }),
  f("Figs (Anjeer / Teen)", N, "Haar-Ratab 1", "Laxative; clears the chest", "Common fig", { good: { symptoms: ["constipat", "cough", "weak", "piles"], conditions: ["constipation", "piles", "asthma", "anaemia"] }, avoid: { conditions: ["diabetes"] } }),
  f("Pear (Nashpati / Kummathra)", F, "Barid-Ratab 1", "Cooling, light", "Pear", { good: { symptoms: ["burning", "constipat"] } }),
  f("Peach (Aaru / Khokh)", F, "Barid-Ratab 2", "Cooling, laxative", "Peach", { good: { symptoms: ["constipat", "burning"] }, avoid: { symptoms: ["cough", "loose"] } }),
  f("Plum (Aloo bukhara)", F, "Barid-Ratab 2", "Sour-sweet; laxative, settles bile", "Plum", { good: { symptoms: ["constipat", "nausea", "burning", "thirst"] }, avoid: { symptoms: ["cough", "joint"] } }),
  f("Apricot (Khubani / Mishmish)", F, "Barid-Ratab 1", "Laxative; good for blood", "Apricot", { good: { symptoms: ["constipat", "pale"], conditions: ["anaemia", "constipation"] } }),
  f("Jamun (Java plum)", F, "Barid-Yabis 2", "Astringent; lowers sugar", "Syzygium cumini", { good: { symptoms: ["loose", "diarr"], conditions: ["diabetes"] }, avoid: { symptoms: ["constipat", "cough"] } }),
  f("Indian gooseberry (Amla / Amlaj)", F, "Barid-Yabis 2", "Cooling, strengthening; rich in vitamin C", "Phyllanthus emblica", { good: { symptoms: ["burning", "acid", "hair fall", "pale", "bleeding"], conditions: ["diabetes", "acidity", "anaemia", "liver"] }, avoid: { symptoms: ["cough", "constipat"] } }),
  f("Pineapple (Ananas)", F, "Haar-Ratab 1", "Digestive; sour", "Pineapple", { good: { symptoms: ["indigestion", "joint"] }, avoid: { symptoms: ["acid", "ulcer", "mouth ulcer"], conditions: ["acidity", "diabetes"] } }),
  f("Sapodilla (Chikoo)", F, "Haar-Ratab 1", "Sweet, nourishing, heavy", "Sapodilla", { good: { symptoms: ["weak", "constipat"] }, avoid: { conditions: ["diabetes", "obesity"] }, heavy: true }),
  f("Mulberry (Shahtoot / Toot)", F, "Barid-Ratab 1", "Soothes the throat and heat", "Mulberry", { good: { symptoms: ["sore throat", "mouth ulcer", "burning", "heat", "fever"] } }),
  f("Quince (Bahi / Safarjal)", F, "Barid-Yabis 1", "Astringent; strengthens stomach and heart", "Quince", { good: { symptoms: ["loose", "diarr", "nausea", "vomit", "palpitation"], conditions: ["heart"] }, avoid: { symptoms: ["constipat"] } }),
  f("Coconut (Narjeel)", N, "Haar-Ratab 2", "Nourishing, heavy", "Coconut", { good: { symptoms: ["weak", "weight loss"] }, avoid: { symptoms: ["indigestion"], conditions: ["cholesterol", "heart", "obesity"] }, heavy: true }),
  f("Jackfruit (Kathal)", F, "Haar-Ratab 2", "Very heavy; gas-forming", "Jackfruit", { avoid: { symptoms: ["bloat", "gas", "indigestion"], conditions: ["diabetes", "ibs"] }, heavy: true, nafakh: true }),
  f("Strawberry", F, "Barid-Ratab 1", "Cooling", "Strawberry", { avoid: { symptoms: ["itch", "rash"], conditions: ["skin"] } }),

  // Dry fruits, nuts & seeds
  f("Almonds (Badam / Lauz)", N, "Haar-Ratab 1", "Strengthens brain, nerves and body", "Almond", { good: { symptoms: ["weak", "forget", "dry", "constipat", "sleep"], conditions: ["heart", "cholesterol"] }, allergens: ["Almonds"] }),
  f("Walnut (Akhrot / Jauz)", N, "Haar-Yabis 2", "Strengthens brain; hot", "Walnut", { good: { symptoms: ["forget", "weak", "joint"], conditions: ["heart", "cholesterol"] }, avoid: { symptoms: ["burning", "heat", "mouth ulcer"] }, allergens: ["Walnuts"] }),
  f("Pistachio (Pista / Fustuq)", N, "Haar-Yabis 2", "Strengthens heart and liver", "Pistachio", { good: { symptoms: ["weak", "palpitation"] }, avoid: { symptoms: ["burning", "heat"], conditions: ["obesity"] }, allergens: ["Pistachio"] }),
  f("Cashew (Kaju)", N, "Haar-Ratab 2", "Rich, heavy", "Cashew", { good: { symptoms: ["weak", "weight loss"] }, avoid: { conditions: ["obesity", "cholesterol"] }, heavy: true }),
  f("Raisins (Kishmish / Munaqqa)", N, "Haar-Ratab 1", "Laxative; good for chest and blood", "Raisin", { good: { symptoms: ["constipat", "cough", "pale", "weak"], conditions: ["anaemia", "constipation"] }, avoid: { conditions: ["diabetes"] } }),
  f("Pine nuts (Chilgoza)", N, "Haar-Ratab 2", "Warming, strengthening", "Pine nut", { good: { symptoms: ["weak", "joint", "cold"] }, allergens: ["Pine Nut"] }),
  f("Peanuts (Moongphali)", N, "Haar-Ratab 2", "Heavy, oily", "Peanut", { avoid: { symptoms: ["acid", "itch", "indigestion"], conditions: ["acidity", "skin"] }, heavy: true, allergens: ["Peanut"] }),
  f("Flaxseed (Alsi / Katan)", N, "Haar-Yabis 1", "Mucilaginous; eases bowel, lowers lipids", "Flax", { good: { symptoms: ["constipat", "cough"], conditions: ["cholesterol", "constipation", "heart", "diabetes"] }, allergens: ["Flaxseed"] }),
  f("Sesame (Til / Simsim)", N, "Haar-Ratab 2", "Warming, oily; strengthens bones", "Sesame", { good: { symptoms: ["joint", "dry", "weak", "cold"], conditions: ["arthritis"] }, avoid: { symptoms: ["burning", "heat", "heavy periods"] }, allergens: ["Sesame"] }),
  f("Pumpkin seeds (Tukhm-e-Kaddu)", N, "Barid-Ratab 1", "Cooling; good for urine", "Pumpkin seed", { good: { symptoms: ["urin", "burning on passing urine", "sleep"] } }),
  f("Melon seeds (Maghz-e-Tukhm-e-Kharbuza)", N, "Barid-Ratab 1", "Diuretic, cooling", "Melon", { good: { symptoms: ["urin", "burning on passing urine"], conditions: ["kidney_stones"] } }),

  // Dairy
  f("Buttermilk (Chhachh / Lassi)", D, "Barid-Ratab 1", "Light; aids digestion", "Buttermilk", { good: { symptoms: ["indigestion", "loose", "diarr", "burning", "acid"], conditions: ["piles", "ibs"] }, avoid: { symptoms: ["cough", "phlegm", "sore throat"], conditions: ["asthma"] }, allergens: ["Milk & Dairy"] }),
  f("Ghee (Raughan-e-Zard)", O, "Haar-Ratab 1", "Nourishing; lubricates bowel and joints", "Clarified butter", { good: { symptoms: ["dry", "constipat", "weak", "joint"] }, avoid: { conditions: ["cholesterol", "heart", "obesity"] }, allergens: ["Ghee / Clarified Butter"] }),
  f("Butter (Maska / Zubd)", O, "Haar-Ratab 1", "Rich, heavy", "Butter", { good: { symptoms: ["dry", "weak"] }, avoid: { conditions: ["cholesterol", "heart", "obesity"] }, heavy: true, allergens: ["Milk & Dairy"] }),
  f("Cottage cheese (Paneer / Jubn)", D, "Barid-Ratab 1", "Heavy protein; constipating for some", "Paneer", { good: { symptoms: ["weak", "weight loss"] }, avoid: { symptoms: ["indigestion", "constipat", "phlegm"] }, heavy: true, allergens: ["Milk & Dairy"] }),
  f("Cream (Malai)", D, "Barid-Ratab 2", "Very rich and heavy", "Cream", { avoid: { symptoms: ["indigestion", "weight gain", "phlegm"], conditions: ["cholesterol", "obesity", "heart"] }, heavy: true, allergens: ["Milk & Dairy"] }),
  f("Goat milk (Shir-e-Buz)", D, "Barid-Ratab 1", "Lighter than cow milk; restorative", "Goat milk", { good: { symptoms: ["weak", "fever", "cough", "loose"] }, allergens: ["Milk & Dairy"] }),

  // Meat, fish & eggs
  f("Chicken (Murgh / Dajaj)", M, "Haar-Ratab 1", "Light meat; restorative", "Chicken as food", { good: { symptoms: ["weak", "fatigue", "weight loss"] }, avoid: { conditions: ["gout"] } }),
  f("Chicken soup (Shorba)", M, "Haar-Ratab 1", "Light, warming, restorative", "Chicken soup", { good: { symptoms: ["weak", "cough", "cold", "fever", "fatigue"] } }),
  f("Goat meat (Bakra / Laham-e-Ma'iz)", M, "Haar-Ratab 1", "Balanced, nourishing red meat", "Goat meat", { good: { symptoms: ["weak", "weight loss", "pale"], conditions: ["anaemia"] }, avoid: { conditions: ["gout", "cholesterol", "heart"] } }),
  f("Fish (Mahi / Samak)", M, "Barid-Ratab 1", "Light; good for heart and joints", "Fish as food", { good: { symptoms: ["joint", "weak"], conditions: ["heart", "cholesterol", "arthritis"] }, avoid: { symptoms: ["itch", "rash"], conditions: ["skin"] }, allergens: ["Fish"] }),
  f("Eggs (Baiza / Anda)", M, "Haar-Ratab 1", "Soft-boiled yolk is nourishing", "Egg as food", { good: { symptoms: ["weak", "weight loss", "pale"] }, avoid: { conditions: ["cholesterol"] }, allergens: ["Eggs"] }),
  f("Liver (Kaleji)", M, "Haar-Ratab 2", "Builds blood; rich", "Liver (food)", { good: { symptoms: ["pale", "weak"], conditions: ["anaemia"] }, avoid: { conditions: ["gout", "cholesterol"] } }),
  f("Prawns & shellfish (Jheenga)", M, "Barid-Ratab 1", "Allergenic for many", "Shrimp", { avoid: { symptoms: ["itch", "rash", "joint"], conditions: ["gout", "skin", "cholesterol"] }, allergens: ["Shellfish"] }),
  f("Partridge & quail (Teetar / Bater)", M, "Haar-Yabis 1", "Light game meat; restorative", "Partridge", { good: { symptoms: ["weak", "cough", "cold"] } }),

  // Spices
  f("Turmeric (Haldi / Zard chob)", S, "Haar-Yabis 2", "Purifies blood; anti-inflammatory", "Turmeric", { good: { symptoms: ["joint", "cough", "itch", "rash", "sore throat"], conditions: ["arthritis", "skin", "liver"] }, allergens: ["Turmeric"] }),
  f("Cumin (Zeera / Kammun)", S, "Haar-Yabis 2", "Carminative; settles wind and nausea", "Cumin", { good: { symptoms: ["bloat", "gas", "indigestion", "nausea", "loose"], conditions: ["ibs"] }, allergens: ["Cumin"] }),
  f("Fennel (Saunf / Badiyan)", S, "Haar-Yabis 2", "Carminative; gentle for stomach and eyes", "Fennel", { good: { symptoms: ["bloat", "gas", "indigestion", "acid", "painful periods"] }, allergens: ["Fennel"] }),
  f("Cinnamon (Darchini)", S, "Haar-Yabis 2", "Warming; lowers sugar", "Cinnamon", { good: { symptoms: ["cold", "cough", "bloat"], conditions: ["diabetes", "cholesterol"] }, avoid: { symptoms: ["burning", "heat", "bleeding", "heavy periods"] }, allergens: ["Cinnamon"] }),
  f("Green cardamom (Elaichi / Heel)", S, "Haar-Yabis 2", "Aromatic; settles nausea, sweetens breath", "Cardamom", { good: { symptoms: ["nausea", "vomit", "bad breath", "indigestion", "palpitation"] }, allergens: ["Cardamom"] }),
  f("Clove (Laung / Qaranfal)", S, "Haar-Yabis 3", "Strongly warming; for teeth and cough", "Clove", { good: { symptoms: ["cough", "cold", "toothache"] }, avoid: { symptoms: ["burning", "heat", "acid", "ulcer"], conditions: ["acidity"] }, allergens: ["Clove"] }),
  f("Saffron (Zafran)", S, "Haar-Yabis 2", "Exhilarant; strengthens heart", "Saffron", { good: { symptoms: ["low mood", "palpitation", "weak", "painful periods"], conditions: ["heart"] }, avoid: { symptoms: ["heavy periods", "bleeding"] }, allergens: ["Saffron"] }),
  f("Carom seeds (Ajwain / Nankhwah)", S, "Haar-Yabis 3", "Strong carminative", "Ajwain", { good: { symptoms: ["bloat", "gas", "indigestion", "abdominal cramp", "cough", "cold"] }, avoid: { symptoms: ["burning", "acid", "ulcer"], conditions: ["acidity"] }, allergens: ["Ajwain"] }),
  f("Coriander seeds (Kishneez)", S, "Barid-Yabis 1", "Cooling digestive", "Coriander", { good: { symptoms: ["burning", "acid", "nausea", "urin"], conditions: ["acidity"] }, allergens: ["Coriander"] }),
  f("Fenugreek seeds (Methi dana / Hulba)", S, "Haar-Yabis 2", "Bitter; lowers sugar, eases joints", "Fenugreek", { good: { symptoms: ["joint", "constipat"], conditions: ["diabetes", "cholesterol", "arthritis"] }, avoid: { symptoms: ["burning", "heat"] }, allergens: ["Fenugreek"] }),
  f("Black seed (Kalonji / Shuneez)", S, "Haar-Yabis 3", "Warming; for cough, wind and immunity", "Nigella sativa", { good: { symptoms: ["cough", "phlegm", "bloat", "gas", "joint"], conditions: ["diabetes", "asthma", "cholesterol"] }, avoid: { symptoms: ["burning", "heat", "bleeding"] }, allergens: ["Black Seed"] }),
  f("Asafoetida (Hing / Hiltheet)", S, "Haar-Yabis 3", "Powerful carminative", "Ferula assa-foetida", { good: { symptoms: ["bloat", "gas", "abdominal cramp"], conditions: ["ibs"] }, avoid: { symptoms: ["burning", "acid"], conditions: ["acidity"] } }),
  f("Table salt (excess)", S, "Haar-Yabis 2", "Excess raises pressure and water retention", "Salt", { avoid: { symptoms: ["swelling", "itch"], conditions: ["hypertension", "kidney", "heart"] } }),
  f("Rock salt (Sendha namak)", S, "Haar-Yabis 1", "Digestive; milder than table salt", "Halite", { good: { symptoms: ["indigestion", "bloat"] }, avoid: { conditions: ["hypertension", "kidney"] } }),
  f("Mustard seeds (Rai / Khardal)", S, "Haar-Yabis 3", "Very heating", "Mustard seed", { avoid: { symptoms: ["burning", "heat", "acid", "itch"], conditions: ["acidity", "skin"] }, allergens: ["Mustard"] }),

  // Oils & fats
  f("Olive oil (Raughan-e-Zaitoon)", O, "Haar-Ratab 1", "Good for heart, joints and skin", "Olive oil", { good: { symptoms: ["dry", "joint", "constipat"], conditions: ["heart", "cholesterol", "arthritis"] } }),
  f("Mustard oil (Raughan-e-Sarson)", O, "Haar-Yabis 2", "Warming cooking oil", "Mustard oil", { good: { symptoms: ["cold", "joint"] }, avoid: { symptoms: ["burning", "heat", "acid"] } }),
  f("Coconut oil (Raughan-e-Narjeel)", O, "Haar-Ratab 1", "Light on skin; heavy in excess", "Coconut oil", { avoid: { conditions: ["cholesterol", "heart"] } }),
  f("Vanaspati & hydrogenated fat", O, "Haar-Ratab 2", "Trans fats; burdens heart and liver", "Trans fat", { avoid: { symptoms: ["indigestion", "weight gain"], conditions: ["cholesterol", "heart", "obesity", "liver", "diabetes"] }, heavy: true }),

  // Sweeteners
  f("White sugar (Shakar)", SW, "Haar-Ratab 1", "Empty calories", "Sugar", { avoid: { symptoms: ["weight gain", "cough", "phlegm", "itch"], conditions: ["diabetes", "obesity", "pcos", "skin"] } }),
  f("Jaggery (Gur / Qand-e-Siyah)", SW, "Haar-Yabis 2", "Warming; contains iron", "Jaggery", { good: { symptoms: ["pale", "cough", "cold"], conditions: ["anaemia"] }, avoid: { symptoms: ["burning", "heat", "boil"], conditions: ["diabetes", "obesity"] } }),
  f("Rock sugar (Mishri / Nabat)", SW, "Barid-Ratab 1", "Cooling sweetener; soothes throat", "Rock candy", { good: { symptoms: ["sore throat", "cough", "burning"] }, avoid: { conditions: ["diabetes"] } }),
  f("Gulqand (rose petal jam)", SW, "Barid-Ratab 1", "Cooling, mild laxative", "Gulkand", { good: { symptoms: ["constipat", "burning", "heat", "acid", "mouth ulcer"], conditions: ["acidity", "constipation", "piles"] }, avoid: { conditions: ["diabetes"] } }),

  // Drinks
  f("Coconut water (Ma-ul-Narjeel)", DR, "Barid-Ratab 1", "Rehydrating, cooling", "Coconut water", { good: { symptoms: ["burning", "heat", "loose", "diarr", "vomit", "urin", "thirst"], conditions: ["kidney_stones", "hypertension"] }, avoid: { conditions: ["kidney"] } }),
  f("Green tea", DR, "Haar-Yabis 1", "Lighter than black tea; aids metabolism", "Green tea", { good: { conditions: ["obesity", "cholesterol", "diabetes"] }, avoid: { symptoms: ["acid", "sleep", "insomnia", "anxi"] } }),
  f("Rose water sherbet (Sharbat-e-Gulab)", DR, "Barid-Ratab 1", "Cooling, exhilarant", "Rose water", { good: { symptoms: ["burning", "heat", "palpitation", "low mood"] }, avoid: { conditions: ["diabetes"] } }),
  f("Sandalwood sherbet (Sharbat-e-Sandal)", DR, "Barid-Yabis 1", "Cooling for heat and palpitation", "Santalum album", { good: { symptoms: ["burning", "heat", "palpitation", "burning on passing urine"] }, avoid: { conditions: ["diabetes"] } }),
  f("Fennel water (Arq-e-Badiyan)", DR, "Haar-Yabis 1", "Gentle digestive", "Fennel", { good: { symptoms: ["bloat", "gas", "indigestion"] } }),
  f("Sugarcane juice (Ras)", DR, "Barid-Ratab 1", "Cooling; for jaundice and urine", "Sugarcane juice", { good: { symptoms: ["burning", "urin", "yellow"], conditions: ["liver"] }, avoid: { conditions: ["diabetes", "obesity"] } }),
  f("Fizzy soft drinks", DR, "Barid-Yabis 1", "Sugar and gas; no nourishment", "Soft drink", { avoid: { symptoms: ["bloat", "gas", "acid", "weight gain"], conditions: ["diabetes", "obesity", "acidity", "kidney_stones"] } }),
  f("Warm water (Ma-e-Har)", DR, "Haar-Ratab 1", "Aids digestion and phlegm", "Drinking water", { good: { symptoms: ["cough", "phlegm", "indigestion", "constipat", "cold"] } }),

  // Prepared foods
  f("Pickles (Achar)", PF, "Haar-Yabis 2", "Salty, sour and oily", "South Asian pickle", { avoid: { symptoms: ["acid", "burning", "swelling"], conditions: ["acidity", "hypertension", "kidney"] } }),
  f("Fast food & junk food", PF, "Haar-Ratab 2", "Refined, fatty, salty", "Fast food", { avoid: { symptoms: ["indigestion", "acid", "weight gain", "constipat"], conditions: ["obesity", "diabetes", "cholesterol", "heart", "liver", "hypertension"] }, heavy: true }),
  f("Bakery items (biscuits, cakes)", PF, "Haar-Ratab 1", "Refined flour, sugar and fat", "Biscuit", { avoid: { symptoms: ["constipat", "weight gain"], conditions: ["diabetes", "obesity", "constipation"] }, heavy: true, allergens: ["Wheat / Gluten"] }),
  f("Vegetable soup (Shorba-e-Tarkari)", PF, "Mu'tadil", "Light and nourishing", "Vegetable soup", { good: { symptoms: ["fever", "weak", "cough", "indigestion"] } }),
  f("Stale & reheated food", PF, "Barid-Yabis 1", "Produces Sauda and weak digestion", "Leftovers", { avoid: { symptoms: ["indigestion", "bloat", "low mood", "itch"], conditions: ["skin", "ibs"] } }),
];
