// Starter guidance for the assessment stages (2–5): tours start on the first visit to each stage.
// Decision-support features are described as aids — the Hakim decides; nothing is done automatically.
import type { StarterDoc, StarterTour } from "./starter-content";

const REC = "/facility/patients/[id]/record";

export const STAGE_TOURS: StarterTour[] = [
  {
    key: "stage2", moduleKey: "clinic.record", name: "Stage 2 — vitals & triage tour", audience: [], trigger: "first_visit",
    title: "Stage 2: Vitals & triage",
    steps: [
      { id: "tracker", route: REC, target: "stage.tracker", title: "The five stages", body: "Every visit moves through Registration, Vitals & triage, Mizaj, Asbab and Tashkhees & handover. Finished stages can be reopened from here." },
      { id: "patient", route: REC, target: "stage.patient", title: "Who you are seeing", body: "The patient's details, visit count and any earlier decision to continue against medical advice. Click the photo to change it." },
      { id: "vitals", route: REC, target: "record.vitals", title: "Record vitals", body: "Press **Add Reading** for blood pressure, pulse, temperature, SpO2, breathing rate, height and weight. Pick the units that suit you. Readings build the chart." },
      { id: "complaints", route: REC, target: "stage.complaints", title: "Main complaints", body: "Complaints from reception's intake are already here. Add or remove them as the consultation reveals more, and click one to fill in its details, such as how severe it is and when it started." },
      { id: "redflags", route: REC, target: "record.redflags", title: "Emergency warning signs", body: "Tick any warning sign you find. If one is present, the patient is referred, or their decision to continue against medical advice is recorded." },
      { id: "symptoms", route: REC, target: "record.symptoms", title: "Other symptoms", body: "Search and add accompanying symptoms, such as thirst, nausea or poor sleep." },
      { id: "insight", route: REC, target: "stage.insight", title: "Hakeem Insight", body: "Reads the vitals, complaints and warning signs and suggests humoral clues. It is decision support only. The Hakim decides." },
      { id: "note", route: REC, target: "stage.note", title: "Clinical note", body: "Type a point and press Enter. Notes stay with the visit for the senior Hakim." },
      { id: "actions", route: REC, target: "stage.actions", placement: "top", title: "Save, refer or continue", body: "**Save Draft** keeps your work. **Refer Patient** opens the referral. **Proceed** opens Stage 3 once vitals are saved." },
    ],
  },
  {
    key: "stage3", moduleKey: "clinic.mizaj", name: "Stage 3 — mizaj tour", audience: [], trigger: "first_visit",
    title: "Stage 3: Mizaj & morphometry",
    steps: [
      { id: "regions", route: "/facility/mizaj", target: "mizaj.regions", title: "Body regions", body: "Choose the body regions and organ systems involved. Regions specific to one gender only show for patients of that gender." },
      { id: "complaints", route: "/facility/mizaj", target: "stage.complaints", title: "Complaint details", body: "Review and complete each complaint's details. Durations entered here also fill in the chronology below." },
      { id: "chronology", route: "/facility/mizaj", target: "mizaj.chronology", title: "Onset & chronology", body: "How it started (sudden or gradual) and its rhythm over time." },
      { id: "insight", route: "/facility/mizaj", target: "stage.insight", title: "Insight and history", body: "Hakeem Insight updates with the new findings. Earlier Mizaj results for this patient are listed underneath." },
      { id: "actions", route: "/facility/mizaj", target: "stage.actions", placement: "top", title: "Continue to Stage 4", body: "**Save Draft** at any time. **Proceed** saves everything and opens the Asbab-e-Sitta review." },
    ],
  },
  {
    key: "stage4", moduleKey: "clinic.asbab", name: "Stage 4 — asbab tour", audience: [], trigger: "first_visit",
    title: "Stage 4: Asbab-e-Sitta",
    steps: [
      { id: "pillars", route: "/facility/asbab", target: "asbab.pillars", title: "The six essential factors", body: "Air, food and drink, physical activity and rest, emotional state, sleep and waking, and retention and elimination. Choose **key questions only** to finish quickly, or show every question." },
      { id: "drift", route: "/facility/asbab", target: "asbab.drift", title: "Lifestyle drift", body: "Shows which habits pull the patient away from balance, based on the answers so far." },
      { id: "actions", route: "/facility/asbab", target: "stage.actions", placement: "top", title: "Complete the review", body: "Answer the required question in each factor, then **Proceed** to the Tashkhees & handover dossier." },
    ],
  },
  {
    key: "stage5", moduleKey: "clinic.tashkhees", name: "Stage 5 — tashkhees & handover tour", audience: [], trigger: "first_visit",
    title: "Stage 5: Tashkhees & handover",
    steps: [
      { id: "dalail", route: "/facility/tashkhees", target: "dossier.dalail", title: "Dala'il: clinical signs", body: "Record the examination findings, such as pulse, tongue and urine. Questions adapt to what is already known." },
      { id: "diagnosis", route: "/facility/tashkhees", target: "dossier.diagnosis", title: "Tashkhees: diagnosis", body: "The patient's constitution, the present dyscrasia and the organs affected." },
      { id: "usool", route: "/facility/tashkhees", target: "dossier.usool", title: "Usool-e-Ilaj: principles", body: "The treatment strategy the plan below will follow." },
      { id: "cds", route: "/facility/tashkhees", target: "dossier.cds", title: "Decision support", body: "Suggests suitable Unani medicines and supplements for the recorded findings. It also lists safety exclusions, for example allergies, and anything still needed. It is a pilot and only an aid." },
      { id: "dawa", route: "/facility/tashkhees", target: "dossier.dawa", title: "Diet, medicines and regimens", body: "Ilaj-bil-Ghiza (diet and restrictions), Ilaj-bil-Dawa (medicines; the dose is always the Hakim's own entry) and Ilaj-bil-Tadbeer (Hijama, Dalk and other regimens)." },
      { id: "handover", route: "/facility/tashkhees", target: "dossier.handover", title: "Prognosis & handover", body: "The expected course, follow-up, warning signs for the patient and a summary for the treating Hakim." },
      { id: "actions", route: "/facility/tashkhees", target: "stage.actions", placement: "top", title: "Finalise and hand over", body: "**Finalise Dossier & Hand Over** completes the visit. You can still update it afterwards. The print button gives the full assessment report." },
    ],
  },
];

export const STAGE_DOCS: StarterDoc[] = [
  {
    key: "doc-stage2", moduleKey: "clinic.record", name: "Stage 2 tutorial", title: "Stage 2: Vitals & triage (Clinical Record)",
    sections: {
      overview: "The Clinical Record is where a visit's assessment begins: vitals, main complaints, emergency screening and other symptoms, with decision support alongside.",
      purpose: "Capture the essentials safely and decide whether the patient can continue in the clinic or must be referred.",
      access: "Nurses, Hakims and other staff whose role includes **Stage 2 — Vitals & Triage**. Anyone with **View patients** can read it.",
      permissions: "**Stage 2 — Vitals & Triage** to record. **Refer patients** to refer. **Reports** to print the assessment report.",
      controls: "- **Stage tracker**: the five stages; finished ones can be reopened\n- **Vitals**: Add Reading, Edit Last Reading (for a short time), chart\n- **Main complaints**: add or remove; click one to fill in its details\n- **Emergency warning signs**: refer, or record the patient's decision\n- **Other symptoms**: search and add\n- **Hakeem Insight**: humoral clues from the findings\n- **Resident clinical note**\n- **Save Draft / Refer Patient / Proceed**",
      workflow: "1. Add a vitals reading\n2. Check and complete the main complaints\n3. Screen for emergency warning signs\n4. Add other symptoms\n5. Optionally generate Hakeem Insight and add notes\n6. **Proceed to Mizaj Morphometry (Stage 3)**",
      fields: "- **Units**: temperature in °F or °C, height in cm or feet and inches (e.g. 5 7), weight in kg or lb\n- **SpO2**: the marker shows where the reading falls between normal and low\n- **Severity (Shiddat-e-Marad)**: per complaint",
      behaviour: "Proceed becomes available once vitals are saved. Referring a patient ends the assessment here and records where they were sent.",
      validation: "- Diastolic must be lower than systolic; the two numbers may be swapped\n- Numbers only in number fields\n- A complaint's details are saved with Save Draft or Proceed",
      troubleshooting: "- **Hakeem Insight paused**: its AI credits have run out. Everything else works as usual\n- **A section wasn't saved**: its own message says why; the rest was saved",
      security: "Decision support never replaces the Hakim's judgement. Referral decisions and continuing against medical advice are recorded on the visit.",
      next: "Continue to [Stage 3: Mizaj & morphometry](/facility/mizaj).",
    },
    faqs: [
      { id: "proceed", q: "Why can't I press Proceed?", a: "Proceed needs at least one saved vitals reading for this visit." },
      { id: "ama", q: "The patient refuses referral. What do I do?", a: "Record their decision in the warning-signs section. It is saved on the visit, and the assessment can continue." },
    ],
  },
  {
    key: "doc-stage3", moduleKey: "clinic.mizaj", name: "Stage 3 tutorial", title: "Stage 3: Mizaj & morphometry",
    sections: {
      overview: "Stage 3 deepens the assessment: the body regions involved, complete complaint details, and how the illness began and progressed.",
      purpose: "Build the picture of temperament and the course of illness that the later stages rely on.",
      access: "Staff whose role includes **Stage 3 — Temperament**.",
      controls: "- **Body regions**: choose the regions and organ systems involved\n- **Main complaints**: full details per complaint\n- **Onset & chronology**: how it started and its rhythm; filled in from the complaint durations\n- **Hakeem Insight**, **Mizaj history** and the **clinical note** on the right",
      workflow: "1. Select the body regions\n2. Complete each complaint's details\n3. Check the onset and chronology\n4. **Proceed to Asbab-e-Sittah Review (Stage 4)**",
      behaviour: "Saving recalculates the humoral assessment. Proceed saves every section first.",
      troubleshooting: "If one section isn't saved, its message explains why. Everything else is kept, so fix that section and save again.",
      next: "Continue to [Stage 4: Asbab-e-Sitta](/facility/asbab).",
    },
    faqs: [{ id: "regions", q: "Why are some body regions missing?", a: "Regions specific to one gender only show for patients of that recorded gender." }],
  },
  {
    key: "doc-stage4", moduleKey: "clinic.asbab", name: "Stage 4 tutorial", title: "Stage 4: Asbab-e-Sitta Zarooriya",
    sections: {
      overview: "The six essential factors of Unani medicine are reviewed for the patient: air, food and drink, physical activity and rest, emotional state, sleep and waking, and retention and elimination.",
      purpose: "Find the lifestyle causes behind the imbalance, so the treatment plan can address them.",
      access: "Staff whose role includes **Stage 4 — Lifestyle Factors**.",
      controls: "- **Which questions to show**: each factor's key question only, or every question\n- **Lifestyle drift**: what pulls the patient away from balance\n- **Save Draft / Proceed**",
      workflow: "1. Choose how many questions to show\n2. Answer at least the key question in every factor\n3. **Proceed to Tashkhees & Handover Dossier (Stage 5)**",
      validation: "Each factor's required question must be answered before the stage can be completed.",
      next: "Continue to [Stage 5: Tashkhees & handover](/facility/tashkhees).",
    },
    faqs: [{ id: "time", q: "Do I have to answer every question?", a: "No. Key questions only are enough to complete the stage. Add more detail when it helps." }],
  },
  {
    key: "doc-stage5", moduleKey: "clinic.tashkhees", name: "Stage 5 tutorial", title: "Stage 5: Tashkhees & handover dossier",
    sections: {
      overview: "The Hakim's dossier brings the visit together on one screen: Dala'il, Tashkhees, Usool-e-Ilaj, Ilaj (diet, medicines, regimens), and prognosis and handover.",
      purpose: "Record the diagnosis and treatment plan, and hand the patient over with a clear summary.",
      access: "Staff whose role includes **Stage 5 — Diagnosis & Plan**. Prescribing medicines also needs **Prescribe medicines**.",
      controls: "- **Jump bar**: go straight to any of the five parts\n- **Dala'il**: examination findings\n- **Tashkhees**: constitution, present dyscrasia, organs affected\n- **Usool-e-Ilaj**: treatment principles\n- **Decision support**: Unani medicines, supplements, safety exclusions, information still needed\n- **Ilaj-bil-Ghiza / Dawa / Tadbeer**\n- **Prognosis & handover**",
      workflow: "1. Record the Dala'il findings\n2. Set the diagnosis\n3. Write the treatment principles\n4. Plan diet, medicines and regimens, using decision support as an aid\n5. Write the prognosis, warning signs and handover summary\n6. **Finalise Dossier & Hand Over**",
      fields: "- **Dose**: always the Hakim's own entry; nothing is filled in automatically\n- **Badraqa**: what to take the medicine with, e.g. lukewarm water\n- **Warning signs**: what should bring the patient back immediately",
      behaviour: "Finalising marks the visit as handed over. You can still update the finalised dossier later. The print button produces the full assessment report.",
      security: "Decision support is a pilot and its data is under review. It suggests options and flags allergies, but the Hakim decides every prescription.",
      next: "See the patient's [Prescriptions](/facility/prescriptions).",
    },
    faqs: [
      { id: "cds", q: "Decision support shows nothing.", a: "It needs recorded findings. Add the complaints and the diagnosis, and it updates. The prescription itself works without it." },
      { id: "edit", q: "Can I change a finalised dossier?", a: "Yes. Edit it and press **Update Finalised Dossier**." },
    ],
  },
];
