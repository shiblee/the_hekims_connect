// Starter catalogues for Stage 2 triage — Emergency Warning Signs and
// Accompanying Acute Symptoms (Alamat-e-Izafiya). Warning signs follow
// standard emergency-triage red flags; Unani terms are given only where a
// classical term is well established. All are admin-editable (Meta → Patient)
// and should be reviewed by the clinic's Unani physicians before relying on
// them. Seeding is add-only: existing rows are never changed or reactivated.

export interface WarningSignSeed { key: string; label: string; description: string }

export const WARNING_SIGN_SEED: WarningSignSeed[] = [
  // Heart & circulation (Qalb wa Urooq)
  { key: "chest_pain_radiating", label: "Chest pain spreading to arm, jaw or back, with sweating (Waja-us-Sadr)", description: "Possible heart attack — urgent emergency referral" },
  { key: "tearing_chest_back_pain", label: "Sudden tearing pain in chest or between shoulder blades", description: "Possible aortic dissection" },
  { key: "shock_signs", label: "Cold, clammy skin with weak, rapid pulse (Nabz-e-Zaeef)", description: "Shock — circulatory collapse" },
  { key: "palpitations_faint", label: "Racing or irregular heartbeat with faintness or chest pain (Khafqan-e-Shadeed)", description: "Dangerous heart rhythm" },
  { key: "breathless_lying_flat", label: "Breathless when lying flat or frothy pink sputum", description: "Acute heart failure / fluid in lungs" },
  { key: "swollen_painful_leg", label: "One leg suddenly swollen, painful, hot and red", description: "Possible deep-vein thrombosis (clot)" },

  // Breathing (Tanaffus)
  { key: "cyanosis", label: "Blue or grey lips, tongue or fingertips", description: "Low oxygen — cyanosis" },
  { key: "cannot_speak_breathless", label: "Too breathless to speak a full sentence (Zeeq-un-Nafas shadeed)", description: "Severe asthma attack or respiratory failure (Rabv)" },
  { key: "stridor_choking", label: "Noisy breathing (stridor), choking or drooling (Khunaq)", description: "Upper-airway obstruction" },
  { key: "haemoptysis", label: "Coughing up blood (Nafs-ud-Dam)", description: "Haemoptysis — urgent assessment" },
  { key: "low_oxygen", label: "Oxygen saturation 92% or below", description: "Hypoxia — needs oxygen and urgent review" },
  { key: "rapid_breathing", label: "Breathing faster than 30 per minute (adult)", description: "Respiratory distress" },

  // Brain & nerves (Dimagh wa A'sab)
  { key: "face_arm_weakness", label: "Sudden face drooping, arm or leg weakness on one side (Falij / Laqwa)", description: "Stroke — FAST: act immediately" },
  { key: "slurred_speech_confusion", label: "Sudden slurred speech, confusion or trouble understanding", description: "Possible stroke or brain emergency" },
  { key: "thunderclap_headache", label: "Sudden 'worst ever' headache (Suda'-e-Shadeed)", description: "Possible brain haemorrhage" },
  { key: "seizure", label: "Fit, seizure or convulsion (Sar'a / Tashannuj)", description: "Especially a first fit or one lasting over 5 minutes" },
  { key: "meningism", label: "Headache with fever, stiff neck and dislike of light (Sirsam)", description: "Possible meningitis" },
  { key: "sudden_vision_loss", label: "Sudden loss of vision or double vision", description: "Stroke, retinal or nerve emergency" },
  { key: "head_injury_red", label: "Head injury with vomiting, drowsiness or loss of consciousness", description: "Possible brain injury" },
  { key: "syncope", label: "Unexplained fainting or collapse (Ghashi)", description: "Especially with chest pain, palpitations or on exertion" },
  { key: "severe_vertigo", label: "Sudden severe vertigo with inability to walk (Duwar-e-Shadeed)", description: "Possible stroke of the balance centre" },

  // Stomach & bowel (Mi'da wa Ama'a)
  { key: "haematemesis", label: "Vomiting blood or coffee-ground material (Qai-ud-Dam)", description: "Upper gastrointestinal bleeding" },
  { key: "melaena", label: "Black tarry stools or heavy bleeding from the back passage", description: "Gastrointestinal bleeding" },
  { key: "bowel_obstruction", label: "Severe colicky pain with vomiting and no passage of stool or wind (Ilaus)", description: "Possible intestinal obstruction" },
  { key: "severe_dehydration", label: "Severe dehydration — no urine for 12 hours, sunken eyes, very dry mouth", description: "Needs urgent fluids" },
  { key: "persistent_vomiting", label: "Vomiting everything — cannot keep any fluid down", description: "Risk of dehydration and electrolyte imbalance" },
  { key: "jaundice_confusion", label: "Yellow eyes or skin with confusion, drowsiness or bleeding (Yarqan)", description: "Possible liver failure" },

  // Kidney & urinary (Kulya wa Masana)
  { key: "urinary_retention", label: "Unable to pass urine with painful, swollen bladder (Ihtibas-ul-Baul)", description: "Acute urinary retention" },
  { key: "renal_colic_fever", label: "Severe loin-to-groin pain with fever or vomiting (Waja-ul-Kulya)", description: "Infected or obstructed kidney stone" },
  { key: "testicular_pain", label: "Sudden severe testicular pain or swelling", description: "Possible testicular torsion — time-critical" },

  // Pregnancy & women's health (Amraz-e-Niswan)
  { key: "pregnancy_bleeding", label: "Bleeding or severe abdominal pain in pregnancy", description: "Miscarriage, placental or ectopic emergency" },
  { key: "pre_eclampsia", label: "Severe headache, blurred vision or sudden swelling in pregnancy", description: "Possible pre-eclampsia" },
  { key: "eclampsia", label: "Fit or convulsion in pregnancy or after delivery", description: "Eclampsia — obstetric emergency" },
  { key: "reduced_fetal_movement", label: "Reduced or absent baby movements in late pregnancy", description: "Needs same-day obstetric check" },
  { key: "postpartum_haemorrhage", label: "Heavy bleeding after delivery — soaking a pad within an hour (Nazf-ur-Rahem)", description: "Postpartum haemorrhage" },
  { key: "ectopic_signs", label: "Missed period with lower abdominal pain and fainting", description: "Possible ectopic pregnancy" },

  // Fever & infection (Hummiyat)
  { key: "very_high_fever", label: "Very high fever — 104°F (40°C) or above (Humma-e-Haadda)", description: "Hyperpyrexia" },
  { key: "non_blanching_rash", label: "Fever with a rash that does not fade when pressed with a glass", description: "Possible meningococcal infection" },
  { key: "infant_fever", label: "Any fever in a baby under 3 months", description: "Needs urgent medical assessment" },
  { key: "spreading_redness", label: "Rapidly spreading painful red skin or skin turning dark", description: "Severe skin and tissue infection" },

  // Sugar & metabolism
  { key: "sugar_extremes", label: "Very high or very low blood sugar with drowsiness or confusion", description: "Diabetic emergency" },
  { key: "dka_breath", label: "Fruity-smelling breath with deep, rapid breathing", description: "Possible diabetic ketoacidosis" },

  // Injury, bites & poisoning
  { key: "poisoning", label: "Suspected poisoning or overdose (Tasammum)", description: "Bring the container or substance if possible" },
  { key: "snake_scorpion", label: "Snake bite or scorpion sting (Nahsh / Ladgh-e-Aqrab)", description: "Needs antivenom assessment" },
  { key: "animal_bite", label: "Dog or animal bite with deep wound (Kalb-e-Kalib)", description: "Rabies risk — post-exposure care" },
  { key: "major_burn", label: "Large, deep, facial or electrical burn (Harq)", description: "Needs burns care" },
  { key: "major_injury", label: "Major injury, deformed limb or deep wound (Kasr)", description: "Possible fracture or serious trauma" },
  { key: "drowning_shock", label: "Near-drowning or electric shock", description: "Needs hospital observation" },
  { key: "fall_cannot_stand", label: "Fall followed by inability to stand or bear weight", description: "Possible hip or spine fracture" },

  // Spine & joints
  { key: "cauda_equina", label: "Back pain with leg weakness, numb saddle area or loss of bladder/bowel control", description: "Possible spinal cord compression" },
  { key: "hot_swollen_joint", label: "Single hot, swollen, very painful joint with fever", description: "Possible joint infection" },

  // Eyes, face & skin
  { key: "painful_red_eye", label: "Sudden painful red eye with blurred vision or halos", description: "Possible acute glaucoma" },
  { key: "chemical_eye", label: "Chemical or object injury to the eye", description: "Rinse and refer immediately" },
  { key: "face_tongue_swelling", label: "Swelling of the face, lips, tongue or throat", description: "Angioedema — airway risk" },
  { key: "skin_peeling", label: "Widespread blistering or peeling skin, often after a new medicine", description: "Severe drug reaction" },

  // Mind (Nafsani)
  { key: "self_harm", label: "Thoughts of suicide or self-harm", description: "Needs same-day mental-health support" },
  { key: "acute_agitation", label: "Violent or severely agitated behaviour, or hallucinations (Junoon)", description: "Acute behavioural emergency" },

  // Children (Atfal)
  { key: "child_lethargic", label: "Child very drowsy, floppy, hard to wake or not feeding", description: "Seriously unwell child" },
  { key: "child_chest_indrawing", label: "Child with chest indrawing, grunting or very fast breathing", description: "Severe pneumonia signs" },
  { key: "child_dehydration", label: "Child with sunken eyes, no tears and very few wet nappies", description: "Severe dehydration in a child" },
];

export interface SymptomSeed { label: string; description: string }

// Accompanying acute symptoms (Alamat-e-Izafiya). The description gives the
// Unani term; a humour is noted only for classical diagnostic signs.
export const OTHER_SYMPTOM_SEED: SymptomSeed[] = [
  // General (Umoomi)
  { label: "Tiredness / fatigue", description: "I'ya" },
  { label: "Body ache", description: "Takassur / Waja-ul-Badan" },
  { label: "Heaviness of the body", description: "Siql-e-Badan — Balgham / Dam sign" },
  { label: "Chills with fever (rigors)", description: "Qushariri" },
  { label: "Feeling of heat / burning in the body", description: "Hararat / Sozish — Safra sign" },
  { label: "Excessive sweating", description: "Kasrat-e-Araq" },
  { label: "Night sweats", description: "Araq-e-Laili" },
  { label: "Unintended weight loss", description: "Huzal" },
  { label: "Weight gain", description: "Siman" },
  { label: "Loss of appetite", description: "Zof-e-Ishtiha" },
  { label: "Excessive hunger", description: "Joo-ul-Baqar" },
  { label: "Excessive drowsiness / oversleeping", description: "Subat — Balgham sign" },
  { label: "General weakness", description: "Zof-e-Aam" },

  // Head & nerves (Sar wa A'sab)
  { label: "Headache", description: "Suda'" },
  { label: "Heaviness of the head", description: "Siql-e-Sar" },
  { label: "Dizziness / vertigo", description: "Duwar" },
  { label: "Tingling or numbness", description: "Khadar" },
  { label: "Tremor", description: "Ra'sha" },
  { label: "Forgetfulness", description: "Nisyan" },
  { label: "Irritability / quick anger", description: "Ghazab — Safra sign" },
  { label: "Anxiety / worry", description: "Qalaq" },
  { label: "Low mood / sadness", description: "Huzn — Sauda sign" },

  // Eyes, ears, nose & throat
  { label: "Redness of the eyes", description: "Surkhi-e-Chashm — Dam sign" },
  { label: "Watery eyes", description: "Dam'a" },
  { label: "Yellowish eyes", description: "Zardi-e-Chashm (Yarqan)" },
  { label: "Blurred vision", description: "Zof-e-Basarat" },
  { label: "Ringing in the ears", description: "Taneen / Dawi" },
  { label: "Blocked nose", description: "Insidad-e-Anf" },
  { label: "Runny nose", description: "Nazla / Zukam" },
  { label: "Sneezing", description: "Atas" },
  { label: "Sore throat", description: "Waja-ul-Halaq" },
  { label: "Hoarse voice", description: "Bahha-e-Saut" },
  { label: "Mouth ulcers", description: "Qula'" },
  { label: "Bad breath", description: "Bakhar-ul-Fam" },
  { label: "Bleeding gums", description: "Nazf-ud-Dam-e-Lissa" },

  // Taste & mouth (Zaiqa) — classical humoral signs
  { label: "Sour taste in mouth", description: "Humuzat-e-Dahan — Sauda sign" },
  { label: "Sweet taste in mouth", description: "Halawat-e-Dahan — Dam sign" },
  { label: "Salty taste in mouth", description: "Mulooha-e-Dahan — Balgham-e-Malih sign" },
  { label: "Loss of taste / tasteless mouth", description: "Be-maza'i — Balgham sign" },
  { label: "Dry mouth", description: "Yubusat-e-Dahan" },

  // Chest (Sadr)
  { label: "Dry cough", description: "Sual-e-Yabis" },
  { label: "Cough with phlegm", description: "Sual-e-Ratab — Balgham sign" },
  { label: "Wheezing", description: "Rabv" },
  { label: "Breathlessness on exertion", description: "Zeeq-un-Nafas" },
  { label: "Heaviness in the chest", description: "Siql-e-Sadr" },
  { label: "Palpitations", description: "Khafqan" },
  { label: "Swelling of the feet", description: "Waram-e-Qadam" },

  // Stomach & bowel (Mi'da wa Ama'a)
  { label: "Nausea", description: "Ghasyan" },
  { label: "Vomiting", description: "Qai" },
  { label: "Bloating / gas", description: "Nafkh / Riyah" },
  { label: "Belching", description: "Jusha" },
  { label: "Hiccups", description: "Fawaq" },
  { label: "Indigestion", description: "Su-e-Hazm" },
  { label: "Abdominal cramps", description: "Maghs" },
  { label: "Constipation", description: "Qabz" },
  { label: "Loose stools", description: "Ishal" },
  { label: "Undigested food in stool", description: "Zalaq-ul-Ama'a" },

  // Urine (Baul) — classical urine signs
  { label: "Burning on passing urine", description: "Hurqat-ul-Baul" },
  { label: "Frequent urination", description: "Kasrat-ul-Baul" },
  { label: "Passing urine at night", description: "Kasrat-ul-Baul-e-Laili" },
  { label: "Reduced urine", description: "Qillat-ul-Baul" },
  { label: "Dark yellow / high-coloured urine", description: "Baul-e-Zard — Safra sign" },
  { label: "Pale / whitish urine", description: "Baul-e-Abyaz — Balgham sign" },

  // Skin & hair (Jild wa Sha'r)
  { label: "Itching", description: "Hikka / Khārish" },
  { label: "Skin rash / hives", description: "Shara" },
  { label: "Dry skin", description: "Yubusat-e-Jild — Sauda sign" },
  { label: "Pale skin", description: "Safedi-e-Rang — Balgham sign" },
  { label: "Yellowish skin", description: "Zardi-e-Rang (Yarqan)" },
  { label: "Hair fall", description: "Suqoot-e-Sha'r" },
  { label: "Boils / pimples", description: "Dammal / Busoor" },

  // Joints & muscles (Mafasil wa Adhal)
  { label: "Joint pain", description: "Waja-ul-Mafasil" },
  { label: "Joint stiffness", description: "Tasallub-e-Mafasil" },
  { label: "Muscle cramps", description: "Tashannuj-e-Adhal" },
  { label: "Back pain", description: "Waja-uz-Zahr" },

  // Women's health (Niswan)
  { label: "Painful periods", description: "Usr-e-Tams" },
  { label: "Irregular periods", description: "Be-qaidagi-e-Tams" },
  { label: "Heavy periods", description: "Kasrat-e-Tams" },
  { label: "White discharge", description: "Sayalan-ur-Rahem" },
  { label: "Hot flushes", description: "Sudden waves of heat" },
];
