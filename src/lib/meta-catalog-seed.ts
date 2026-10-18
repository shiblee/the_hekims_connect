// Enrichment for four Admin → Meta lists: Aggravating / Relieving factors, Emergency Warning Signs
// (red flags) and Accompanying Acute Symptoms. Unani terms are given where established; the lists
// are deliberately open — general clinical items sit alongside Unani ones. Add-only: existing rows
// (matched by label, case-insensitive; red flags also by key) are never changed.

import type { PrismaClient } from "@prisma/client";

export const AGGRAVATING_FACTORS: string[] = [
  // Air & season (Hawa-e-Muheet)
  "Cold wind / draught", "Humid weather", "Dry weather", "Hot sun exposure", "Rainy / monsoon season", "Winter season",
  "Summer season", "Spring season", "Autumn season", "Change of season", "Dust / smoke", "Pollen", "Strong smells / perfume",
  "Air conditioning", "Direct fan air", "Polluted air", "High altitude",
  // Food & drink (Ma'kool-o-Mashroob)
  "Spicy food", "Oily / fried food", "Sour food", "Sweet / sugary food", "Salty food", "Cold food & drinks", "Hot drinks",
  "Heavy meals / overeating", "Empty stomach / fasting", "Late-night eating", "Milk / dairy", "Wheat / gluten", "Red meat",
  "Gas-forming food (beans, cabbage)", "Brinjal / nightshades", "Rice", "Fermented food", "Tea / coffee", "Alcohol",
  "Smoking / tobacco", "Carbonated drinks", "Junk / processed food", "Citrus fruits", "Chocolate", "Stale food",
  "Change of drinking water", "Irregular meal times",
  // Movement & rest (Harkat-o-Sukoon-e-Badani)
  "Walking", "Climbing stairs", "Bending forward", "Lifting weight", "Prolonged sitting", "Prolonged standing",
  "Lying flat", "Lying on the affected side", "Getting up from bed", "Twisting the body", "Neck movement",
  "Raising the arm overhead", "Running / sport", "Sexual activity", "Inactivity", "Long travel / driving",
  "Typing / repetitive hand use", "Gripping", "Kneeling / squatting",
  // Sleep (Naum-o-Yaqza)
  "Lack of sleep", "Daytime sleep", "Late nights", "Waking at night",
  // Mind (Harkat-o-Sukoon-e-Nafsani)
  "Anger", "Anxiety / worry", "Grief / sadness", "Fear", "Excitement", "Mental strain / study", "Loud noise",
  "Bright light", "Screen use", "Work pressure", "Arguments / conflict",
  // Retention & evacuation (Ihtibas-o-Istifragh)
  "Constipation / straining", "Holding urine or stool", "During periods", "Before periods", "Pregnancy", "Menopause",
  "Excess sweating", "After vomiting", "After diarrhoea",
  // Body & touch
  "Coughing / sneezing", "Deep breathing", "Swallowing", "Chewing", "Touch / pressure on the area", "Cold-water bath",
  "Hot bath", "Washing the hair", "Tight clothing", "Wearing footwear",
  // Time of day
  "Morning", "Afternoon", "Evening", "After meals", "Before meals",
  // Medicines & other
  "Missing a medicine dose", "Painkillers (NSAIDs)", "A new medicine", "Travel", "Contact with animals", "Contact with chemicals",
];

export const RELIEVING_FACTORS: string[] = [
  // Regimens (Ilaj-bil-Tadbeer)
  "Hot fomentation (Takmeed)", "Oil application (Tadheen)", "Steam inhalation (Inkebab)", "Cupping (Hijamat)",
  "Foot soak in warm water (Pashoya)", "Head massage", "Gargling (Ghargharah)", "Nasal drops / saline rinse",
  "Hot bath", "Cool bath / shower", "Sunlight", "Exercise (Riyazat)",
  // Environment
  "Fresh air", "Cool room / fan", "Warm room / staying indoors", "Dark, quiet room", "Change of climate",
  "Warm clothing", "Loosening tight clothing",
  // Position & movement
  "Lying down", "Lying on one side", "Sitting up / propped up", "Leaning forward", "Raising the limb",
  "Gentle walking", "Stretching / yoga", "Physiotherapy", "Keeping still", "Changing position", "Pressing on the area",
  "Support / bandage", "Brace or splint",
  // Food & drink
  "Light meals", "Eating something", "Skipping a meal", "Warm water / drinks", "Cold water / drinks",
  "Herbal decoction (Joshanda)", "Honey", "Ginger", "Milk", "Buttermilk / lassi", "Bland diet (Parhez)",
  "Avoiding spicy food", "Fennel / ajwain water", "Fruit / fibre",
  // Evacuation (Istifragh)
  "Passing wind / belching", "Bowel movement", "Vomiting", "Passing urine", "Sweating",
  // Medicines
  "Antacid", "Painkiller", "Prescribed medicine", "Unani medicine", "Inhaler", "Antihistamine",
  // Mind
  "Meditation / prayer", "Deep breathing", "Distraction / company", "Reassurance", "Music",
  // Time
  "In the morning", "In the evening", "After sleep", "In winter", "In summer",
];

export const RED_FLAGS: { key: string; label: string; description: string }[] = [
  // Heart & circulation
  { key: "severe_hypertension", label: "BP 180/120 or higher with headache, chest pain or breathlessness", description: "Hypertensive emergency" },
  { key: "extreme_pulse", label: "Pulse below 40 or above 140 at rest", description: "Serious arrhythmia — needs an ECG" },
  { key: "low_bp_symptoms", label: "Systolic BP below 90 with dizziness, confusion or cold skin", description: "Hypotension / shock" },
  { key: "new_exertional_chest_pain", label: "New chest pain on exertion that eases with rest", description: "Unstable angina" },
  { key: "heart_failure_worsening", label: "Rapid weight gain with leg swelling and breathlessness", description: "Worsening heart failure" },
  { key: "cold_pale_limb", label: "Sudden cold, pale, painful arm or leg", description: "Acute limb ischaemia" },
  // Breathing
  { key: "severe_asthma", label: "Asthma attack not settling with the usual inhaler", description: "Acute severe asthma" },
  { key: "sudden_breathless_sharp_pain", label: "Sudden breathlessness with sharp one-sided chest pain", description: "Pneumothorax / pulmonary embolism" },
  { key: "inhaled_object", label: "Choking episode or inhaled object, especially in a child", description: "Airway foreign body" },
  { key: "tb_features", label: "Cough over 3 weeks with weight loss, night sweats or blood in sputum", description: "Tuberculosis — urgent tests" },
  // Brain & nerves
  { key: "headache_over50_jaw", label: "New headache after 50 with scalp tenderness or jaw pain on chewing", description: "Giant cell arteritis — risk of blindness" },
  { key: "headache_raised_pressure", label: "Headache waking from sleep or worse on coughing, with vomiting", description: "Raised intracranial pressure" },
  { key: "ascending_weakness", label: "Weakness spreading up both legs over hours or days", description: "Guillain–Barré syndrome" },
  { key: "sudden_confusion_elderly", label: "Sudden confusion in an older person", description: "Delirium — infection, stroke or metabolic cause" },
  { key: "prolonged_seizure", label: "Seizure lasting over 5 minutes, or repeated without waking", description: "Status epilepticus" },
  { key: "spinal_injury", label: "Neck or back injury with numbness, tingling or weakness", description: "Spinal cord injury — keep still" },
  // Abdomen
  { key: "appendicitis_signs", label: "Pain moving to the right lower abdomen with fever and vomiting", description: "Appendicitis" },
  { key: "pain_out_of_proportion", label: "Severe abdominal pain in an older person, worse than examination suggests", description: "Mesenteric ischaemia / aortic aneurysm" },
  { key: "pulsatile_mass", label: "Pulsating lump in the abdomen with back or abdominal pain", description: "Abdominal aortic aneurysm" },
  { key: "progressive_dysphagia", label: "Increasing difficulty swallowing with weight loss", description: "Urgent referral — rule out cancer" },
  { key: "swallowed_hazard", label: "Swallowed button battery, magnet or sharp object", description: "Needs urgent removal" },
  { key: "bloody_diarrhoea_fever", label: "Bloody diarrhoea with fever and abdominal pain", description: "Dysentery / colitis" },
  { key: "strangulated_hernia", label: "Painful, hard hernia that will not go back", description: "Strangulated hernia" },
  { key: "alcohol_withdrawal", label: "Shaking, sweating or hallucinations after stopping alcohol", description: "Severe alcohol withdrawal" },
  { key: "pale_stools_jaundice", label: "Painless jaundice with pale stools and dark urine", description: "Biliary obstruction — urgent tests" },
  // Kidney & urine
  { key: "acute_kidney", label: "Very little or no urine with swelling or breathlessness", description: "Acute kidney injury" },
  { key: "heavy_haematuria", label: "Heavy blood or clots in the urine", description: "Urgent urology assessment" },
  { key: "missed_dialysis", label: "Missed dialysis with weakness or breathlessness", description: "High potassium / fluid overload" },
  // Pregnancy & women
  { key: "preterm_waters", label: "Fluid leaking from the vagina before 37 weeks", description: "Preterm rupture of membranes" },
  { key: "hyperemesis", label: "Cannot keep food or fluids down in pregnancy", description: "Hyperemesis gravidarum" },
  { key: "postmenopausal_bleeding", label: "Any bleeding after menopause", description: "Urgent gynaecology referral" },
  { key: "heavy_period_faint", label: "Very heavy periods with fainting or breathlessness", description: "Severe blood loss / anaemia" },
  { key: "postpartum_fever", label: "Fever or foul discharge after delivery or miscarriage", description: "Puerperal sepsis" },
  { key: "postpartum_psychosis", label: "Confusion, severe low mood or thoughts of harming the baby after delivery", description: "Postpartum psychosis" },
  // Infection & environment
  { key: "fever_immunosuppressed", label: "Fever while on chemotherapy, long-term steroids or with HIV", description: "Neutropenic sepsis" },
  { key: "fever_malaria_area", label: "Fever after travel to or living in a malaria area", description: "Malaria — test the same day" },
  { key: "dengue_warning", label: "Fever with bleeding gums, severe abdominal pain or persistent vomiting", description: "Dengue warning signs" },
  { key: "prolonged_fever", label: "Fever lasting more than 7 days", description: "Typhoid or other serious infection" },
  { key: "tetanus_signs", label: "Deep dirty wound with jaw stiffness or muscle spasms", description: "Tetanus" },
  { key: "heatstroke", label: "Hot, dry skin with confusion after heat exposure", description: "Heatstroke" },
  { key: "hypothermia", label: "Very cold body with confusion, or shivering that has stopped", description: "Hypothermia" },
  { key: "necrotising_infection", label: "Severe pain out of proportion to a wound, with fever", description: "Necrotising fasciitis" },
  { key: "shingles_eye", label: "Shingles rash on the forehead, nose tip or around the eye", description: "Herpes zoster ophthalmicus" },
  // Hormones & blood
  { key: "adrenal_crisis", label: "On long-term steroids with vomiting, weakness or collapse", description: "Adrenal crisis" },
  { key: "thyroid_storm", label: "Very fast pulse, high fever and agitation with thyroid disease", description: "Thyroid storm" },
  { key: "spontaneous_bleeding", label: "Bleeding gums, nosebleeds or skin spots without injury", description: "Low platelets / bleeding disorder" },
  { key: "anticoagulant_bleed", label: "On blood thinners with significant bleeding or any head injury", description: "Anticoagulant-related bleed" },
  { key: "severe_anaemia", label: "Extreme paleness with breathlessness or chest pain", description: "Severe anaemia" },
  // Eyes, ears, mouth
  { key: "retinal_detachment", label: "Flashes, sudden new floaters or a curtain over vision", description: "Retinal detachment" },
  { key: "sudden_hearing_loss", label: "Sudden hearing loss in one ear", description: "Sudden sensorineural hearing loss — same-day referral" },
  { key: "cannot_open_mouth_swallow", label: "Severe sore throat with drooling or unable to open the mouth", description: "Quinsy / epiglottitis" },
  { key: "dental_spreading_swelling", label: "Spreading facial or neck swelling from a tooth", description: "Deep neck infection (Ludwig's angina)" },
  { key: "uncontrolled_nosebleed", label: "Nosebleed not stopping after 20 minutes of pressure", description: "Severe epistaxis" },
  // Bones & limbs
  { key: "compartment_syndrome", label: "Severe pain and tightness in a limb after injury or plaster", description: "Compartment syndrome" },
  { key: "back_pain_cancer_fever", label: "Back pain with a history of cancer, fever or weight loss", description: "Spinal metastasis / infection" },
  // Mind & safety
  { key: "new_psychosis", label: "New hallucinations or strange beliefs with risk to self or others", description: "Acute psychosis" },
  { key: "abuse_concern", label: "Signs of abuse or neglect — child, older person or partner", description: "Safeguarding concern" },
  // Children
  { key: "bulging_fontanelle", label: "Bulging soft spot on a baby's head", description: "Meningitis / raised pressure" },
  { key: "child_abnormal_cry", label: "Baby with a high-pitched, weak or continuous cry", description: "Serious illness in an infant" },
  { key: "green_vomit_child", label: "Child vomiting green (bile)", description: "Bowel obstruction" },
  { key: "newborn_jaundice", label: "Yellow skin in the first 24 hours of life, or very yellow baby", description: "Neonatal jaundice" },
  // Cancer warning
  { key: "unexplained_weight_loss", label: "Unexplained loss of more than 10% of body weight", description: "Urgent work-up — rule out cancer" },
  { key: "growing_lump", label: "Rapidly growing lump, or a lump that bleeds", description: "Urgent cancer referral" },
];

export const ACUTE_SYMPTOMS: { label: string; description: string }[] = [
  // General
  { label: "Fever", description: "Humma" },
  { label: "Low-grade evening fever", description: "Mild fever, rising in the evening" },
  { label: "Feeling cold all the time", description: "Cold intolerance — Barid tendency" },
  { label: "Heat intolerance", description: "Uneasy in warm weather — Haar tendency" },
  { label: "Excessive thirst", description: "Atash" },
  { label: "Reduced thirst", description: "Qillat-e-Atash — Balgham sign" },
  { label: "Swollen glands", description: "Enlarged nodes in neck, armpit or groin" },
  { label: "Puffy face in the morning", description: "Facial swelling on waking" },
  { label: "Generalised swelling", description: "Istisqa' — body-wide swelling" },
  { label: "Easy bruising", description: "Bruises without clear injury" },
  { label: "Pale nails or palms", description: "Possible anaemia" },
  { label: "Craving for sweets", description: "Desire for sweet food" },
  { label: "Craving for salty or sour food", description: "Desire for salty / sour taste" },
  { label: "Aversion to food", description: "Nafrat-e-Ta'am" },
  { label: "Feeling full quickly", description: "Early satiety" },
  { label: "Disturbed sleep", description: "Broken or unrefreshing sleep" },
  { label: "Difficulty falling asleep", description: "Sahar" },
  { label: "Nightmares / disturbing dreams", description: "Kabus" },
  { label: "Snoring", description: "Noisy breathing in sleep" },
  { label: "Daytime sleepiness", description: "Sleepy during the day" },
  { label: "Lethargy / sluggishness", description: "Kasal — Balgham sign" },
  { label: "Malaise", description: "General unwell feeling" },
  // Head & nerves
  { label: "One-sided headache", description: "Shaqeeqa (migraine type)" },
  { label: "Headache at the forehead", description: "Frontal / sinus-type headache" },
  { label: "Headache at the back of the head", description: "Occipital headache" },
  { label: "Head feels hot", description: "Hararat-e-Sar" },
  { label: "Dizziness on standing up", description: "Lightheaded when getting up" },
  { label: "Feeling faint", description: "Near-fainting" },
  { label: "Poor concentration", description: "Difficulty focusing" },
  { label: "Pins and needles in hands", description: "Tingling in the hands" },
  { label: "Burning feet", description: "Sozish-e-Qadam" },
  { label: "Muscle twitching", description: "Ikhtilaj" },
  { label: "Weak grip", description: "Reduced hand strength" },
  { label: "Facial pain", description: "Pain over the face" },
  { label: "Sensitivity to light", description: "Photophobia" },
  { label: "Sensitivity to noise", description: "Phonophobia" },
  // Eyes
  { label: "Itchy eyes", description: "Hikka-e-Chashm" },
  { label: "Dry, gritty eyes", description: "Dryness of the eyes" },
  { label: "Eye pain", description: "Waja-ul-Ain" },
  { label: "Sticky eye discharge", description: "Ramad sign" },
  { label: "Puffy eyelids", description: "Swollen lids" },
  { label: "Floaters / spots in vision", description: "Specks drifting in vision" },
  { label: "Poor vision at night", description: "Shabkori" },
  { label: "Dark circles under the eyes", description: "Periorbital darkening" },
  // Ears
  { label: "Earache", description: "Waja-ul-Uzn" },
  { label: "Ear discharge", description: "Sayalan-ul-Uzn" },
  { label: "Reduced hearing", description: "Siql-e-Sama'at" },
  { label: "Blocked ear feeling", description: "Fullness in the ear" },
  { label: "Itchy ears", description: "Itching in the ear canal" },
  // Nose, throat & mouth
  { label: "Nosebleed", description: "Ru'af" },
  { label: "Post-nasal drip", description: "Mucus dripping down the throat" },
  { label: "Loss of smell", description: "Fuqdan-e-Shamm" },
  { label: "Sinus pressure", description: "Fullness over cheeks or forehead" },
  { label: "Thick yellow-green nasal mucus", description: "Purulent nasal discharge" },
  { label: "Difficulty swallowing", description: "Usr-e-Bal'" },
  { label: "Painful swallowing", description: "Pain on swallowing" },
  { label: "Swollen tonsils", description: "Waram-e-Lauzatain" },
  { label: "Coated tongue", description: "White or yellow coating — Balgham / Safra sign" },
  { label: "Cracked lips", description: "Dry, fissured lips" },
  { label: "Toothache", description: "Waja-ul-Asnan" },
  { label: "Swollen gums", description: "Gum swelling" },
  { label: "Burning mouth or tongue", description: "Burning sensation in the mouth" },
  { label: "Jaw pain", description: "Pain at the jaw joint or jaw" },
  // Chest & breathing
  { label: "Chest tightness", description: "Constricted feeling in the chest" },
  { label: "Chest pain on breathing", description: "Waja-ul-Janb sign (pleuritic)" },
  { label: "Cough worse at night", description: "Nocturnal cough" },
  { label: "Blood-streaked phlegm", description: "Streaks of blood in sputum" },
  { label: "Yellow or green phlegm", description: "Purulent sputum" },
  { label: "Frothy white phlegm", description: "Watery / frothy sputum" },
  { label: "Breathless at rest", description: "Short of breath without effort" },
  { label: "Barking cough", description: "Croup-like cough" },
  // Heart & circulation
  { label: "Irregular heartbeat", description: "Skipped or uneven beats" },
  { label: "Chest discomfort on exertion", description: "Effort-related discomfort" },
  { label: "Leg pain on walking", description: "Claudication — eases with rest" },
  { label: "Varicose veins", description: "Dawali" },
  { label: "Swelling of the hands", description: "Puffy hands or fingers" },
  // Stomach & bowels
  { label: "Heartburn / acid reflux", description: "Hurqat-e-Mi'da" },
  { label: "Sour belching", description: "Jusha-e-Hamiz" },
  { label: "Food coming back up", description: "Regurgitation" },
  { label: "Upper abdominal pain", description: "Waja-ul-Mi'da" },
  { label: "Pain around the navel", description: "Periumbilical pain" },
  { label: "Lower abdominal pain", description: "Pain below the navel" },
  { label: "Right upper abdominal pain", description: "Liver / gallbladder area — Waja-ul-Kabid" },
  { label: "Rumbling in the stomach", description: "Qaraqir" },
  { label: "Feeling of incomplete evacuation", description: "Zaheer" },
  { label: "Mucus in stool", description: "Slimy stools" },
  { label: "Fresh blood in stool", description: "Bleeding piles sign" },
  { label: "Itching around the anus", description: "Hikka-e-Maq'ad" },
  { label: "Painful bowel movement", description: "Pain on passing stool" },
  { label: "Piles", description: "Bawaseer" },
  { label: "Alternating constipation and loose stools", description: "Irregular bowel habit" },
  { label: "Hard, dry stools", description: "Yubusat sign" },
  { label: "Greasy, foul-smelling stools", description: "Possible malabsorption" },
  { label: "Worms in stool", description: "Deedan-e-Ama'a" },
  { label: "Pale / clay-coloured stools", description: "Possible bile obstruction" },
  { label: "Morning nausea", description: "Nausea on waking" },
  { label: "Motion sickness", description: "Nausea on travel" },
  // Urine
  { label: "Urgent need to urinate", description: "Urgency" },
  { label: "Difficulty starting urination", description: "Usr-ul-Baul" },
  { label: "Weak urine stream", description: "Poor flow" },
  { label: "Dribbling after urination", description: "Taqteer-ul-Baul" },
  { label: "Leaking urine", description: "Salas-ul-Baul" },
  { label: "Cloudy urine", description: "Turbid urine" },
  { label: "Foul-smelling urine", description: "Strong urine odour" },
  { label: "Blood in urine", description: "Baul-ud-Dam" },
  { label: "Loin pain", description: "Waja-ul-Kulya" },
  { label: "Pain over the bladder", description: "Suprapubic pain" },
  // Women
  { label: "Scanty periods", description: "Qillat-e-Tams" },
  { label: "Missed or delayed periods", description: "Ihtibas-e-Tams" },
  { label: "Bleeding between periods", description: "Intermenstrual bleeding" },
  { label: "Pain during intercourse", description: "Dyspareunia" },
  { label: "Premenstrual discomfort", description: "Symptoms before periods" },
  { label: "Breast pain or tenderness", description: "Mastalgia" },
  { label: "Vaginal itching", description: "Hikka-e-Farj" },
  { label: "Heaviness in the lower abdomen", description: "Pelvic heaviness" },
  { label: "Difficulty conceiving", description: "Uqr" },
  // Men
  { label: "Erectile difficulty", description: "Zof-e-Bah" },
  { label: "Premature ejaculation", description: "Sur'at-e-Inzal" },
  { label: "Low libido", description: "Qillat-e-Shahwat" },
  { label: "Testicular discomfort", description: "Aching in the testes" },
  { label: "Frequent night emissions", description: "Kasrat-e-Ihtilam" },
  // Muscles & joints
  { label: "Neck pain", description: "Waja-ur-Raqaba" },
  { label: "Shoulder pain", description: "Waja-ul-Katif" },
  { label: "Knee pain", description: "Waja-ur-Rukba" },
  { label: "Heel pain", description: "Pain under or behind the heel" },
  { label: "Back pain going down the leg", description: "Irq-un-Nasa (sciatica)" },
  { label: "Hip pain", description: "Waja-ul-Wirk" },
  { label: "Morning stiffness", description: "Stiffness on waking" },
  { label: "Joint swelling", description: "Waram-e-Mafasil" },
  { label: "Cracking joints", description: "Crepitus" },
  { label: "Muscle pain", description: "Waja-ul-Adhal" },
  { label: "Muscle weakness", description: "Zof-e-Adhal" },
  { label: "Hand or wrist pain", description: "Pain in the hand or wrist" },
  { label: "Ankle swelling", description: "Puffy ankles" },
  { label: "Big toe pain and swelling", description: "Niqris (gout) sign" },
  { label: "Bone pain", description: "Deep bony ache" },
  // Skin, hair & nails
  { label: "Dandruff", description: "Hazaz" },
  { label: "Early greying of hair", description: "Shaib" },
  { label: "Patchy hair loss", description: "Da-us-Sa'lab" },
  { label: "White patches on skin", description: "Bahaq / Baras" },
  { label: "Dark patches on skin", description: "Kalf / Namash" },
  { label: "Oily skin", description: "Excess sebum" },
  { label: "Acne", description: "Busoor-e-Labaniya" },
  { label: "Scaly, itchy patches", description: "Eczema-like" },
  { label: "Ringworm / fungal infection", description: "Qooba" },
  { label: "Cracked heels", description: "Shiqaq" },
  { label: "Brittle nails", description: "Weak, splitting nails" },
  { label: "Nail discolouration", description: "Change in nail colour" },
  { label: "Excess body or facial hair", description: "Hirsutism" },
  { label: "Peeling skin", description: "Desquamation" },
  { label: "Blisters", description: "Fluid-filled bumps" },
  { label: "Warts", description: "Saalil" },
  { label: "Burning skin", description: "Burning sensation on the skin" },
  // Mind
  { label: "Fearfulness", description: "Khauf — Sauda sign" },
  { label: "Panic attacks", description: "Sudden intense fear" },
  { label: "Overthinking", description: "Repetitive worrying thoughts" },
  { label: "Loss of interest", description: "No pleasure in usual activities" },
  { label: "Mood swings", description: "Rapid changes in mood" },
  { label: "Feeling hopeless", description: "Hopelessness" },
  { label: "Restless / hyperactive", description: "Excess activity or talk" },
  { label: "Social withdrawal", description: "Avoiding people" },
  // Children
  { label: "Poor feeding (child)", description: "Not feeding well" },
  { label: "Teething trouble", description: "Discomfort with teething" },
  { label: "Bedwetting", description: "Baul-fil-Firash" },
  { label: "Excessive crying (infant)", description: "Inconsolable crying" },
  { label: "Poor growth (child)", description: "Not gaining weight or height" },
  // Hormones & older adults
  { label: "Neck swelling (thyroid area)", description: "Swelling at the front of the neck" },
  { label: "Unsteady walking", description: "Poor balance" },
  { label: "Frequent falls", description: "Repeated falls" },
];

const norm = (s: string) => s.trim().toLowerCase();

/** Adds what's missing; returns counts. Never edits or removes existing rows. */
export async function seedMetaCatalogs(db: PrismaClient, opts: { dryRun?: boolean } = {}) {
  const out = { aggravating: 0, relieving: 0, redFlags: 0, symptoms: 0 };
  const factors = await db.complaintFactorTag.findMany({ select: { kind: true, label: true, sortOrder: true } });
  for (const [kind, list] of [["aggravating", AGGRAVATING_FACTORS], ["relieving", RELIEVING_FACTORS]] as const) {
    const have = new Set(factors.filter((f) => f.kind === kind).map((f) => norm(f.label)));
    let order = Math.max(-1, ...factors.filter((f) => f.kind === kind).map((f) => f.sortOrder)) + 1;
    for (const label of list) {
      if (have.has(norm(label))) continue;
      have.add(norm(label));
      if (!opts.dryRun) await db.complaintFactorTag.create({ data: { kind, label, sortOrder: order } });
      order++; out[kind]++;
    }
  }
  const flags = await db.redFlagCriterion.findMany({ select: { key: true, label: true, sortOrder: true } });
  const flagKeys = new Set(flags.map((f) => f.key)); const flagLabels = new Set(flags.map((f) => norm(f.label)));
  let fo = Math.max(-1, ...flags.map((f) => f.sortOrder)) + 1;
  for (const f of RED_FLAGS) {
    if (flagKeys.has(f.key) || flagLabels.has(norm(f.label))) continue;
    flagKeys.add(f.key); flagLabels.add(norm(f.label));
    if (!opts.dryRun) await db.redFlagCriterion.create({ data: { ...f, sortOrder: fo } });
    fo++; out.redFlags++;
  }
  const syms = await db.acuteSymptomTag.findMany({ select: { label: true, sortOrder: true } });
  const symHave = new Set(syms.map((s) => norm(s.label)));
  let so = Math.max(-1, ...syms.map((s) => s.sortOrder)) + 1;
  for (const s of ACUTE_SYMPTOMS) {
    if (symHave.has(norm(s.label))) continue;
    symHave.add(norm(s.label));
    if (!opts.dryRun) await db.acuteSymptomTag.create({ data: { ...s, sortOrder: so } });
    so++; out.symptoms++;
  }
  return out;
}
