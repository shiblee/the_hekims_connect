// Starter tutorials for the remaining clinic pages and admin pages (English).
// Translations: starter-tr3-{hi,ur,ar,fa}.ts, seeded as "awaiting review".
import type { StarterDoc } from "./starter-content";

export const MORE_DOCS: StarterDoc[] = [
  // ---------- Clinic app ----------
  {
    key: "doc-patients", moduleKey: "clinic.patients", name: "Patients tutorial", title: "Your patient list",
    sections: {
      overview: "Patients lists everyone registered at your clinic, with their last visit and where their current visit has reached.",
      purpose: "Find a patient quickly and continue their visit from the right stage.",
      access: "The clinic owner and staff whose role includes **View patients**.",
      controls: "- **Search**: name, mobile number or patient code\n- **Filters**: All, Seen today, In progress, Handed over and Referred, each with its count\n- **Stage badge**: where the current visit is, from waiting in the queue to handed over\n- **Action button**: Start vitals, Continue, View dossier or View record\n- **Register Patient**: add a new patient",
      tasks: "- **Continue a visit**: press the button next to the stage badge\n- **Open a patient's record**: click their row\n- **See today's patients**: choose the **Seen today** filter",
      behaviour: "Clicking a row opens the patient's current visit record, or their profile when they have no visit yet. A patient marked **Appointment only** has booked but has not been registered for a visit.",
      security: "Only patients registered at your clinic are listed. Never share patient details outside the clinic.",
      next: "New arrivals are registered from the [Reception desk](/facility/reception).",
    },
    faqs: [
      { id: "missing", q: "A patient I'm looking for isn't listed. Why?", a: "Check the filter is set to All and clear the search. Patients registered at another clinic are not shown here; register them, and the search will find their existing record." },
      { id: "declined", q: "What does \"Declined referral\" mean?", a: "The patient was advised to go elsewhere because of a warning sign, and chose to continue here against medical advice. The decision is recorded on their visit." },
    ],
  },
  {
    key: "doc-appointments", moduleKey: "clinic.appointments", name: "Appointments tutorial", title: "Managing appointments",
    sections: {
      overview: "Appointments shows the consultations patients have booked with your clinic, sorted by date and time.",
      purpose: "See who is coming, and mark each appointment as completed or cancelled.",
      access: "The clinic owner and staff whose role includes **Appointments**.",
      controls: "- **Tabs**: All, Today, Upcoming, Completed and Cancelled\n- **Search**: by patient name or appointment type\n- **Complete** and **Cancel**: shown on scheduled appointments\n- **URGENT** badge: shown when the type or reason mentions pain, urgency or emergency",
      behaviour: "Marking an appointment updates it immediately and moves it to the matching tab. A completed or cancelled appointment can't be changed back here.",
      troubleshooting: "If the list doesn't load, use the retry button on the page. An empty tab simply means no appointments match it.",
      next: "When a booked patient arrives, register their visit from the [Reception desk](/facility/reception).",
    },
    faqs: [{ id: "book", q: "How are appointments booked?", a: "Patients book them from their own patient app. They appear here automatically." }],
  },
  {
    key: "doc-messages", moduleKey: "clinic.messages", name: "Messages tutorial", title: "Secure messages",
    sections: {
      overview: "Messages is your clinic's secure inbox for conversations with patients.",
      purpose: "Answer patients' questions without sharing personal phone numbers.",
      access: "The clinic owner and staff whose role includes **Messages**.",
      controls: "- **Conversation list**: newest first, with unread counts\n- **Search conversations**: find a patient's thread\n- **Message box**: type and send; new messages appear by themselves",
      behaviour: "Messages are sent from the clinic, not from you personally, so everyone with access sees the same conversations.",
      security: "Keep messages professional and about the patient's care. Don't send passwords or payment details.",
    },
    faqs: [{ id: "start", q: "Why is my conversation list empty?", a: "A conversation appears once a patient sends your clinic a message." }],
  },
  {
    key: "doc-pharmacy", moduleKey: "clinic.pharmacy", name: "Pharmacy tutorial", title: "Your Unani pharmacy",
    sections: {
      overview: "Pharmacy is your clinic's stock list of Unani formulations, distillates and other items.",
      purpose: "Know what you have, what is running low, and what your stock is worth.",
      access: "The clinic owner and staff whose role includes **Pharmacy**.",
      controls: "- **Totals**: total items, low-stock items, stock value and categories\n- **Search** and **category** filter\n- **Add Item**: name, category, form, quantity and unit, reorder level, price, expiry date and description\n- **Edit** and the bin button on each item",
      fields: "- **Reorder level**: when the quantity falls to this number or below, the item shows LOW\n- **Status**: IN STOCK, LOW, or OUT when the quantity is zero\n- **Stock value**: quantity × price, added up over all items",
      tasks: "- **Update stock after a delivery**: press **Edit** and change the quantity\n- **See what to reorder**: look for the LOW and OUT badges",
      validation: "Removing an item asks you to confirm on the page first. A removed item can't be brought back; add it again if needed.",
    },
    faqs: [{ id: "auto", q: "Does stock go down automatically when I prescribe?", a: "No. Update quantities yourself with **Edit** when you dispense or receive stock." }],
  },
  {
    key: "doc-prescriptions", moduleKey: "clinic.prescriptions", name: "Prescriptions tutorial", title: "Writing prescriptions",
    sections: {
      overview: "Prescriptions lists the Unani prescriptions written for your patients, newest first.",
      purpose: "Record what was prescribed, how it is taken, and any advice for the patient.",
      access: "The clinic owner and staff whose role includes **Prescribe medicines** or **View patients**.",
      workflow: "1. Press **New Prescription**\n2. Choose the patient\n3. Choose the therapy type: Ilaj-bil-Dawa (medicines), Ilaj-bil-Ghadha (diet), Ilaj-bil-Tadbeer (regimens) or Ilaj-bil-Yad (surgery)\n4. Add each remedy with its dose, frequency, duration and instructions; **Add remedy** adds another row\n5. Add notes such as follow-up advice, then save",
      validation: "Rows without a remedy name are left out. Choose a patient before saving.",
      next: "Stock is kept in the [Pharmacy](/facility/pharmacy). Treatment planning for a visit happens in [Stage 5 — Tashkhees & handover](/facility/tashkhees).",
    },
    faqs: [{ id: "edit", q: "Can I change a prescription after saving?", a: "Not from this page. Write a new prescription with the corrected details." }],
  },
  {
    key: "doc-profile", moduleKey: "clinic.profile", name: "Facility profile tutorial", title: "Your facility profile",
    sections: {
      overview: "Facility profile holds your clinic's details in sections: Overview, Location, Capacity & Schedule and Services, plus Fees, Staff, Permissions, Activity log and Learning & tutorials.",
      purpose: "Keep the details patients and the platform see accurate and current.",
      access: "The clinic owner and staff whose role includes **Facility profile & settings**.",
      controls: "- **Overview**: facility name, type, HFR number, establishment date and alternate contact number\n- **Location**: address, locality, city, district, state, country and PIN code\n- **Capacity & Schedule**: bed capacity, average daily OPD, open 24×7, or weekly hours with an optional second shift\n- **Services**: specializations and services, emergency services and ambulance\n- **Save changes**: each section saves on its own",
      validation: "- The **HFR number** is locked once saved; to correct it, contact support\n- Required fields are checked when you save; if saving fails, your changes stay filled in so you can try again",
      next: "Set your [Fees](/facility/profile/fees) and add your [Staff](/facility/profile/staff).",
    },
    faqs: [{ id: "save", q: "Do I need to save each section?", a: "Yes. Each section saves on its own, so press **Save changes** before moving to another section." }],
  },
  {
    key: "doc-activity", moduleKey: "clinic.activity", name: "Activity log tutorial", title: "The activity log",
    sections: {
      overview: "The activity log is a read-only record of sign-ins and actions in your clinic: who did what, and when.",
      purpose: "Check what happened to a patient record or payment, and spot refused or failed actions.",
      access: "Everyone. The clinic owner, and staff with **Clinic activity log**, see the whole clinic; other staff see only their own actions.",
      controls: "- **Period**, **Person**, **Activity type** and **Outcome** filters\n- **Search**: patient, record or text\n- **Outcome**: Succeeded, Failed or Refused (the person didn't have permission)",
      security: "Nobody can edit or delete entries, including the clinic owner.",
    },
    faqs: [{ id: "refused", q: "What does a Refused entry mean?", a: "Someone tried something their role doesn't allow, and it was blocked. Review their permissions if they need it for their work." }],
  },
  {
    key: "doc-visit-vitals", moduleKey: "clinic.visit-vitals", name: "Visit vital signs tutorial", title: "Recording a visit's vital signs",
    sections: {
      overview: "This page records the basic assessment for one visit: blood pressure, pulse, temperature, SpO₂, height and weight.",
      purpose: "Capture the vitals the hakeem needs before the assessment starts.",
      access: "Staff whose role includes **Stage 2 — Vitals & Triage**. Others with **View patients** can look but not save.",
      workflow: "1. Check the patient's name and visit number at the top\n2. Enter each reading; height and weight carry over from the last visit when known\n3. Press **Save Vitals**; the patient's record opens next",
      validation: "Readings outside the normal range are highlighted for a second look. Vitals can only be changed for a limited time after recording, set by your clinic.",
      troubleshooting: "**This assessment is locked** means the editing time has passed. Start a new visit to record fresh vitals.",
      next: "After saving, the patient's record opens so the rest of Stage 2 can be completed.",
    },
    faqs: [],
  },
  {
    key: "doc-visit-screening", moduleKey: "clinic.visit-screening", name: "Visit screening tutorial", title: "L1 screening",
    sections: {
      overview: "L1 Screening records the patient's chief complaints for a visit.",
      purpose: "Capture why the patient came, so the assessment starts from the right complaints.",
      access: "Staff whose role includes **Stage 2 — Vitals & Triage**.",
      workflow: "1. Search for each chief complaint, by typing or by voice\n2. Select every complaint that applies\n3. Press **Complete Screening**",
      behaviour: "The screening result lists the chosen complaints, with Hakeem Insight when the AI service is switched on. Use **Edit Screening** to change it, or **Back to Patient** to continue.",
      validation: "Choose at least one chief complaint before completing.",
    },
    faqs: [],
  },
  {
    key: "doc-visit-consultation", moduleKey: "clinic.visit-consultation", name: "Visit consultation tutorial", title: "Doctor review and treatment plan",
    sections: {
      overview: "The consultation page brings together what reception and triage captured, then records the doctor's review and treatment plan.",
      purpose: "Record findings, diagnosis and the plan for this visit.",
      access: "Staff with **View patients** can read it. Saving needs **Stage 5 — Diagnosis & Plan**.",
      controls: "- **Captured by reception**: patient details, chief complaint and payment from registration\n- **Doctor Review**: clinical findings, working or confirmed diagnosis, investigations, notes, review date, and flags for further investigation or referral\n- **Treatment plan**: objective, planned modalities (diet, medicine, regimen) and rationale",
      workflow: "1. Read the reception and vitals summary\n2. Complete the review and press **Save Review**\n3. Write the plan and press **Save Treatment Plan**",
      validation: "The review and the plan save separately. If saving fails, your entries stay on the page so you can try again.",
    },
    faqs: [],
  },
  // ---------- Admin panel ----------
  {
    key: "doc-admin-patients", moduleKey: "admin.patients", name: "Admin patients tutorial", title: "Patients across the platform",
    sections: {
      overview: "Every patient account on the platform, with their clinic, contact, verification and status.",
      purpose: "Find a patient account, check it, and suspend or reactivate it when needed.",
      access: "Platform administrators.",
      controls: "- **Search**: name, email or phone\n- **Status** and **verification** filters\n- **View**: opens the patient's details, records, appointments, mizaj assessments and prescriptions\n- **Add Patient**: create an account for a clinic",
      tasks: "- **Suspend an account**: open it with **View**, then press **Suspend account**. **Reactivate account** reverses it",
      security: "Patient details are medical information. Open records only when you need to, for support or safety.",
    },
    faqs: [{ id: "suspend", q: "What does suspending do?", a: "The patient can no longer sign in. Their records are kept, and you can reactivate the account at any time." }],
  },
  {
    key: "doc-admin-notifications", moduleKey: "admin.notifications", name: "Admin notifications tutorial", title: "Emails and notifications",
    sections: {
      overview: "Notifications has three parts: Email Configuration, Email Templates and Notification History.",
      purpose: "Control how the platform sends email, what each email says, and check what was sent.",
      access: "Platform administrators.",
      controls: "- **Email Configuration**: provider (Amazon SES or custom SMTP), sender name and address, reply-to, the on/off switch and a test email\n- **Email Templates**: the subject and body of each email, with placeholders and a live preview\n- **Notification History**: every email with its recipient and status: Sent, Failed or Simulated",
      troubleshooting: "- **Simulated** means email sending was off, so nothing actually left the platform\n- **Failed**: check the configuration, then send a test email",
      security: "The SMTP password or key is stored securely and isn't shown again after saving.",
    },
    faqs: [{ id: "test", q: "How do I check email works?", a: "In Email Configuration, send a test email to yourself, then look for it in Notification History." }],
  },
  {
    key: "doc-admin-humor", moduleKey: "admin.humor", name: "Admin humoral matrix tutorial", title: "The Humoral Matrix",
    sections: {
      overview: "The Humoral Matrix sets the findings and point weights that work out a visit's humoral picture (Dam, Balgham, Safra, Sauda) during intake.",
      purpose: "Tune the clinical starting point the intake protocol uses.",
      access: "Platform administrators.",
      controls: "- **Manifestations**: the findings offered for each chief complaint\n- **Weight Rules**: points a finding, onset pattern, severity band or aggravating factor adds to each humour\n- **Severity Scale**: the wording for each level from 1 to 10\n- **Constitutional Tendency**: the label, Unani term and description on each of the four tiles",
      behaviour: "Changes apply to new assessments straight away. Inline fields save when you leave the field or press Enter.",
      security: "These values support clinical decisions. Review changes with a qualified hakeem before relying on them.",
    },
    faqs: [],
  },
  {
    key: "doc-admin-pages", moduleKey: "admin.pages", name: "Admin pages tutorial", title: "Website pages",
    sections: {
      overview: "Pages holds the content of the public website's information pages, in every language.",
      purpose: "Edit and publish page text without changing code.",
      access: "Platform administrators.",
      workflow: "1. Pick a page from the list\n2. Choose a language tab\n3. Edit the title, the optional subtitle and the body\n4. Press **Save Draft** to keep working, or **Publish** to make it live",
      fields: "The body uses Markdown: start a line with ## for a section heading.",
      behaviour: "Each language has its own draft or published status. Visitors see only published text.",
    },
    faqs: [],
  },
  {
    key: "doc-admin-history", moduleKey: "admin.history", name: "Admin history tutorial", title: "History and audit trails",
    sections: {
      overview: "History has three logs: Login History, Activity History and Clinic Activity.",
      purpose: "See who signed in and what was changed, for security checks and support.",
      access: "Platform administrators.",
      controls: "- **Login History**: every sign-in attempt to your admin account, with device, IP address and duration\n- **Activity History**: actions taken on your admin account, such as settings or templates changed\n- **Clinic Activity**: every clinic's sign-ins and actions, with filters by clinic, person, type and outcome",
      security: "Logs can't be edited or deleted. If you see a sign-in you don't recognise, change your password straight away.",
    },
    faqs: [],
  },
  {
    key: "doc-admin-profile", moduleKey: "admin.profile", name: "Admin profile tutorial", title: "Your admin account",
    sections: {
      overview: "Your account covers your profile, password and Learning & tutorials.",
      purpose: "Keep your details current and your account secure.",
      access: "Each administrator, for their own account.",
      controls: "- **Update Profile**: picture, full name and email address\n- **Change Password**: current password, then the new one twice\n- **Learning & Tutorials**: replay any tour or open any tutorial",
      validation: "- A new email address is confirmed with a one-time code sent to it\n- A new password needs at least 8 characters, with letters and numbers",
      behaviour: "After changing your password you are signed out, and you sign in again with the new one.",
    },
    faqs: [],
  },
];
