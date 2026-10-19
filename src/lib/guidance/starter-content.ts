// First guidance content (English): clinic owner onboarding + support staff / reception workflow.
// Seeded once by seedStarterGuidance (never overwrites anything an admin has created or edited).
// Translations live in starter-translations.ts and are seeded as "awaiting review".
import type { DocSectionKey, TourStep } from "./content";

export interface StarterTour {
  key: string; moduleKey: string; name: string; audience: string[]; trigger: "first_login" | "first_visit" | "manual";
  title: string; steps: { id: string; title: string; body: string; route?: string; target?: string; placement?: TourStep["placement"] }[];
}
export interface StarterDoc { key: string; moduleKey: string; name: string; title: string; sections: Partial<Record<DocSectionKey, string>>; faqs: { id: string; q: string; a: string }[] }

export const STARTER_TOURS: StarterTour[] = [
  {
    key: "owner-welcome", moduleKey: "clinic.dashboard", name: "Clinic owner — welcome tour", audience: ["owner"], trigger: "first_login",
    title: "Welcome to your clinic",
    steps: [
      { id: "welcome", title: "Welcome!", body: "This short tour shows where everything is and what to set up first. You can close it at any time and pick it up again from **Facility Profile → Learning & tutorials**." },
      { id: "menu", route: "/facility/dashboard", target: "shell.nav", placement: "right", title: "Your main menu", body: "Everything for daily work is here: the Reception desk, Patients, Payments, Appointments and more. Your staff only see the pages their role allows." },
      { id: "today", route: "/facility/dashboard", target: "dashboard.today", title: "Today at a glance", body: "New and returning patients, visits and money collected today, compared with yesterday. Click a card to see the patients behind it." },
      { id: "fees", route: "/facility/profile/fees", target: "fees.add", title: "Set your fees first", body: "Add your registration and consultation fees. Reception picks from this list when collecting a payment, so amounts stay consistent." },
      { id: "staff", route: "/facility/profile/staff", target: "staff.add", title: "Add your team", body: "Add each staff member with their own email or mobile number. They verify it with a one-time code and then sign in on the same clinic login page." },
      { id: "permissions", route: "/facility/profile/permissions", target: "permissions.roles", title: "Decide who can do what", body: "Each role comes with sensible permissions. Tick or untick boxes to change them, then press **Save permissions**. You, the owner, can always do everything." },
      { id: "help", route: "/facility/dashboard", target: "shell.help", title: "Help on every page", body: "The **?** button opens help for the page you are on: a guided tour and a detailed tutorial." },
      { id: "done", route: "/facility/dashboard", target: "shell.account", placement: "right", title: "You're ready", body: "Your clinic profile, staff and settings are under your name here. **Learning & tutorials** lists every tour, so you can replay any of them." },
    ],
  },
  {
    key: "profile-setup", moduleKey: "clinic.profile-setup", name: "Profile setup tour", audience: ["owner"], trigger: "first_visit",
    title: "Setting up your clinic",
    steps: [
      { id: "intro", title: "Five quick steps", body: "Tell us about your clinic so patients and the platform see the right details. It takes about three minutes, and you can change everything later in Facility Profile." },
      { id: "steps", route: "/facility/profile-setup", target: "setup.steps", title: "Where you are", body: "Facility, Location, Capacity, Services and Plan, then a final review. Each step has its own address, so the browser's back button works too." },
      { id: "continue", route: "/facility/profile-setup", target: "setup.continue", placement: "top", title: "Continue when ready", body: "Required fields are checked before you move on. Your answers are kept on this device as you go, so nothing is lost if you leave and come back." },
      { id: "finish", title: "Finish with a review", body: "On the last step, check the summary and press **Complete profile**. Your free trial starts and your dashboard opens. A confirmation email follows." },
    ],
  },
  {
    key: "reception-staff", moduleKey: "clinic.reception", name: "Support staff — reception tour", audience: ["staff"], trigger: "first_login",
    title: "Your reception workflow",
    steps: [
      { id: "welcome", title: "Welcome to the team", body: "This tour walks you through a typical reception day: registering patients, finding returning ones, and collecting payments. Close it whenever you like; it stays in **Learning & tutorials**." },
      { id: "today", route: "/facility/dashboard", target: "dashboard.today", title: "Today's summary", body: "How many new and returning patients came in today, and how many visits. Click a card to open those patients." },
      { id: "actions", route: "/facility/dashboard", target: "dashboard.actions", title: "Quick actions", body: "Shortcuts for the most common jobs, such as registering a patient or opening the Reception desk." },
      { id: "register", route: "/facility/reception", target: "reception.register", title: "Register a new patient", body: "Start here when someone arrives. You will **search first**, so a returning patient is never registered twice." },
      { id: "week", route: "/facility/reception", target: "reception.week", title: "The seven-day list", body: "Pick a day to see who came in. Use the arrows to look at earlier weeks, and **Back to today** to return." },
      { id: "tabs", route: "/facility/reception", target: "reception.tabs", title: "Visits or new registrations", body: "**Visits** shows everyone seen that day. **New registrations** shows only first-time patients." },
      { id: "search", route: "/facility/reception", target: "reception.search", title: "Find someone quickly", body: "Search by name, patient ID, visit number or phone." },
      { id: "list", route: "/facility/reception", target: "reception.list", title: "Collect and continue", body: "Press **Collect** to record a fee and print a receipt. Press **Continue** to open the patient's next step." },
      { id: "receipts", route: "/facility/payments", target: "payments.list", title: "Receipts and history", body: "Every payment is listed here with its receipt. Payments are never deleted; a cancellation or refund needs a reason and is recorded." },
      { id: "help", route: "/facility/reception", target: "shell.help", title: "Need help later?", body: "Press **?** on any page for its tutorial, or replay this tour from **Learning & tutorials** in your profile." },
    ],
  },
  {
    key: "payments", moduleKey: "clinic.payments", name: "Payments & receipts tour", audience: [], trigger: "first_visit",
    title: "Payments and receipts",
    steps: [
      { id: "totals", route: "/facility/payments", target: "payments.totals", title: "Money collected", body: "Totals for today, the last 7 and 30 days and the last 12 months, after refunds. Cancelled payments are not counted." },
      { id: "search", route: "/facility/payments", target: "payments.search", title: "Find a payment", body: "Search by receipt number, patient, visit or payment reference." },
      { id: "list", route: "/facility/payments", target: "payments.list", title: "Receipts, cancellations and refunds", body: "Open **Receipt** to view or print it again. Staff allowed to do so can **Cancel** or **Refund** a payment with a reason. Nothing is ever deleted." },
      { id: "collect", title: "Collecting a new payment", body: "New payments are collected from the [Reception desk](/facility/reception): press **Collect** on the patient's row." },
    ],
  },
];

export const STARTER_DOCS: StarterDoc[] = [
  {
    key: "doc-profile-setup", moduleKey: "clinic.profile-setup", name: "Profile setup tutorial", title: "Setting up your clinic profile",
    sections: {
      overview: "Profile setup is the first thing a new clinic does. In five short steps you describe your clinic, then review everything and complete the profile.",
      purpose: "Patients and the platform see accurate details, and your free trial starts. Until the profile is complete, the rest of the app stays closed.",
      access: "The clinic owner only.",
      workflow: "1. **Facility**: name, type, HFR number and year established\n2. **Location**: address, area and PIN code\n3. **Capacity**: beds, daily OPD and opening hours (or open 24×7)\n4. **Services**: specializations, services, emergency care and ambulance\n5. **Plan**: your free trial and what follows it\n6. **Review**: check the summary and press **Complete profile**",
      fields: "- **HFR number**: your Health Facility Registry ID: IN followed by 10 digits. Each HFR number can belong to only one clinic, and it is locked once saved\n- **Facility type**: pick the closest; more types are under **More facility types**\n- **Opening hours**: you can add a second shift for clinics that close at midday",
      behaviour: "When you complete the profile, your free trial starts, your dashboard opens and a confirmation email is sent to you.",
      validation: "- Required fields are marked and checked before you continue\n- An HFR number already used by another clinic is refused\n- The establishment date can't be in the future",
      troubleshooting: "- **Lost your place?** Your answers are kept on this device, so open the setup page again\n- **Wrong HFR number after saving?** Contact support to correct it",
      next: "Next, set your [Fees](/facility/profile/fees), add your [Staff](/facility/profile/staff) and review [Permissions](/facility/profile/permissions).",
    },
    faqs: [
      { id: "edit", q: "Can I change my answers later?", a: "Yes. Everything except the saved HFR number can be edited in **Facility Profile**." },
      { id: "trial", q: "What happens when the free trial ends?", a: "Your plan moves to Premium at the price shown on the Plan step. You can see your dates in Facility Profile." },
    ],
  },
  {
    key: "doc-dashboard", moduleKey: "clinic.dashboard", name: "Dashboard tutorial", title: "Your clinic dashboard",
    sections: {
      overview: "The dashboard shows today's activity at a glance: new and returning patients, visits, and money collected or patients waiting for vitals.",
      purpose: "Start the day here, spot what needs attention, and jump straight to the right list.",
      access: "The clinic owner and staff whose role includes **Dashboard**.",
      permissions: "**Dashboard**. The money card appears only for people allowed to see clinic finances.",
      controls: "- **Quick actions**: shortcuts to registration, the Reception desk and other common jobs\n- **Today's figures**: each card compares with yesterday; click one to open those patients\n- **Refresh**: reloads the figures",
      tasks: "- See who is waiting: click **Waiting for vitals**\n- Register a walk-in: use the quick action **Register patient**",
      troubleshooting: "If the figures don't load, press **Refresh**. If it keeps failing, check your internet connection.",
      next: "Most daily work happens on the [Reception desk](/facility/reception).",
    },
    faqs: [{ id: "money", q: "Why don't I see the money collected?", a: "That card is only shown to people allowed to see clinic finances. Ask the clinic owner if you need it." }],
  },
  {
    key: "doc-reception", moduleKey: "clinic.reception", name: "Reception desk tutorial", title: "Using the Reception desk",
    sections: {
      overview: "The Reception desk lists patients by day: every visit, or only new registrations, for the last seven days and earlier weeks.",
      purpose: "See who came in, collect fees, and send each patient on to their next step.",
      access: "The clinic owner and staff whose role includes **View patients**.",
      permissions: "**View patients** to see the list. **Register & edit patients** for the **Register new patient** button. **Collect payments** for the **Collect** button.",
      controls: "- **Seven-day strip**: pick a day; arrows move a week at a time; **Back to today** returns\n- **Visits / New registrations**: every visit, or first-time patients only\n- **Search**: name, patient ID, visit number or phone\n- **Stage** and **Registered by** filters\n- **Collect**: record a fee and print a receipt\n- **Continue**: open the patient's next step",
      workflow: "1. A patient arrives: press **Register new patient** (you will search first)\n2. After registering, the visit appears in today's list\n3. Press **Collect** if a fee is due\n4. Press **Continue** to move the patient to vitals and assessment",
      tasks: "- **Find yesterday's patient**: click yesterday on the strip, then search\n- **Reprint a receipt**: open [Payments](/facility/payments) and press **Receipt**",
      security: "Phone numbers are partly hidden in the list. Never share patient details outside the clinic.",
      next: "See [Register a patient](/facility/patients/register) and [Payments & receipts](/facility/payments).",
    },
    faqs: [
      { id: "twice", q: "Why does a patient appear twice?", a: "**Visits** shows every visit, so a patient seen twice in one day appears twice." },
      { id: "collect", q: "I don't see the Collect button.", a: "Your role doesn't include collecting payments. Ask the clinic owner." },
    ],
  },
  {
    key: "doc-register", moduleKey: "clinic.patient-register", name: "Patient registration tutorial", title: "Registering a patient",
    sections: {
      overview: "Registration records a patient's details and opens their visit. Always **search first**, so the same person is never registered twice.",
      purpose: "Each patient has one record and a patient ID (PT…), and each visit has its own visit number (V…).",
      access: "The clinic owner and staff whose role includes **Register & edit patients**.",
      workflow: "1. **Find existing patient**: search by mobile number or name\n2. If they are found, start a new visit for them\n3. If not, choose **New patient registration**\n4. Fill in the patient, emergency contact and reason for visit\n5. Optionally choose a doctor and collect a fee\n6. Save, then print the wristband",
      fields: "- **Relationship**: who the patient is to the account holder (Self, Son, Mother, …). Choosing it fills in the gender automatically\n- **Mobile number**: one number can be shared by family members\n- **Reason for visit**: symptoms in the patient's own words, allergies and current medicines (Unani or Allopathic tabs)\n- **Payment** (optional): pick a fee from your clinic's list and the payment mode",
      behaviour: "The visit appears on the [Reception desk](/facility/reception) straight away, ready for vitals.",
      validation: "- Name, gender, age and mobile number are required\n- Charging an amount different from the fee list needs a reason, which is recorded",
      troubleshooting: "- **Wristband window didn't open**: allow pop-ups for this site, then print again\n- **Patient registered at another clinic**: an exact match lets you link them without seeing that clinic's records",
      security: "Only enter what the patient tells you. Their records from other clinics stay private.",
      next: "Collect fees and print receipts from the [Reception desk](/facility/reception).",
    },
    faqs: [{ id: "dup", q: "What if I registered someone twice by mistake?", a: "Don't register them again. Tell the clinic owner so the duplicate can be handled." }],
  },
  {
    key: "doc-payments", moduleKey: "clinic.payments", name: "Payments tutorial", title: "Payments and receipts",
    sections: {
      overview: "Payments lists every fee your clinic has collected, with receipts, totals and the payment method used.",
      purpose: "Check collections, reprint receipts, and correct mistakes through cancellations or refunds that are always recorded.",
      access: "The clinic owner and staff with **Collect payments** (they see their own collections) or **Clinic finances** (they see everything).",
      permissions: "**Collect payments**, **Clinic finances**, and **Cancel / refund payments** for corrections.",
      controls: "- **Totals**: today, 7 days, 30 days and 12 months, after refunds\n- **All payments / Collected by me**\n- **Search**: receipt number, patient, visit or reference\n- **Receipt**: view or print again\n- **Cancel / Refund**: needs a reason",
      workflow: "1. Collect a fee from the Reception desk with **Collect**\n2. A receipt is created; its number is the payment code\n3. Find any payment here later to reprint or correct it",
      validation: "- A reason of at least a few words is required to cancel or refund\n- A refund can be partial; it can't exceed what was paid",
      security: "Payments are never deleted. Every cancellation and refund records who did it and why.",
      next: "Set your clinic's fee list in [Fees](/facility/profile/fees).",
    },
    faqs: [
      { id: "delete", q: "Can I delete a wrong payment?", a: "No. **Cancel** it with a reason, then collect the correct amount. The history stays complete." },
      { id: "cancelled", q: "Are cancelled payments counted in totals?", a: "No. Totals count what the clinic actually kept after refunds." },
    ],
  },
  {
    key: "doc-fees", moduleKey: "clinic.fees", name: "Fees tutorial", title: "Your fee list",
    sections: {
      overview: "Fees are the amounts reception picks from when collecting a payment, such as registration, consultation or follow-up.",
      purpose: "Charges stay consistent, and any different amount needs a recorded reason.",
      access: "The clinic owner and staff allowed to change **Facility profile & settings**.",
      workflow: "1. Press **Add fee**\n2. Enter a name, the amount in ₹, and the type\n3. Save. It appears in reception's list straight away",
      fields: "- **Type**: Registration, Consultation, Follow-up or Other\n- **In use**: switch a fee off instead of deleting it",
      behaviour: "Changing a price never changes past receipts.",
      next: "Next, add your [Staff](/facility/profile/staff).",
    },
    faqs: [{ id: "remove", q: "How do I remove a fee?", a: "Switch **In use** off. It disappears from reception's list but stays on past receipts." }],
  },
  {
    key: "doc-staff", moduleKey: "clinic.staff", name: "Staff tutorial", title: "Managing your staff",
    sections: {
      overview: "Add everyone who works in your clinic so they can sign in with their own account.",
      purpose: "Each person signs in separately, sees only what their role allows, and their actions are recorded under their own name.",
      access: "The clinic owner and staff with **Manage staff & permissions**.",
      workflow: "1. Press **Add Staff**\n2. Enter their name and email or mobile number, then **Send verification code** and enter the 6-digit code they receive\n3. Choose employee type, role and responsibilities\n4. Press **Add staff member**",
      fields: "- **Role**: decides what they can do (see Permissions)\n- **Responsibilities**: search and pick as many as apply\n- **Active**: switch off to stop someone signing in, without deleting them",
      validation: "- Each email or mobile number can belong to only one clinic or staff member, because they share the clinic login page\n- A changed email or mobile must be verified again before saving",
      behaviour: "Staff sign in on the clinic login page with a one-time code sent to their email or mobile.",
      next: "Then review [Permissions](/facility/profile/permissions).",
    },
    faqs: [
      { id: "code", q: "The staff member didn't get a code.", a: "Check the spelling, wait for the resend timer, and press **Resend**. Email codes can take a minute." },
      { id: "patient", q: "Can a staff member also be a patient?", a: "Yes. A staff member may use the same email or mobile as a patient record." },
    ],
  },
  {
    key: "doc-permissions", moduleKey: "clinic.permissions", name: "Permissions tutorial", title: "Roles and permissions",
    sections: {
      overview: "Permissions decide what each staff member can see and do. They are set per role, with optional changes for one person.",
      purpose: "People get exactly the access their job needs, and nothing more.",
      access: "The clinic owner and staff with **Manage staff & permissions**.",
      controls: "- **Role grid**: tick or untick a permission for a role, then **Save permissions**\n- **Reset**: return a role to its standard permissions\n- **Per-person changes**: give one person something extra, or take something away",
      workflow: "1. Check each role's column\n2. Change what you need and press **Save permissions**\n3. For one person, use **Per-person changes**",
      behaviour: "Changes apply straight away. When someone tries something they aren't allowed to do, they see a message and the attempt is recorded in the Activity log.",
      security: "The clinic owner always has every permission. Staff can't change their own role or switch themselves off.",
      next: "See who did what in the [Activity log](/facility/profile/activity).",
    },
    faqs: [{ id: "new-role", q: "A new role has no ticks I expected.", a: "Every role starts with standard permissions. Adjust them here and save." }],
  },
];
