// Starter guidance for platform administrators (admin panel).
import type { StarterDoc, StarterTour } from "./starter-content";

const ADMIN = ["admin"];

export const ADMIN_TOURS: StarterTour[] = [
  {
    key: "admin-welcome", moduleKey: "admin.dashboard", name: "Admin — welcome tour", audience: ADMIN, trigger: "first_login",
    title: "Welcome to the admin panel",
    steps: [
      { id: "welcome", title: "Welcome", body: "From here you run the whole platform: clinics, their staff and payments, the option lists every form uses, settings, emails, languages and user guidance." },
      { id: "menu", route: "/admin", target: "admin.nav", title: "The admin menu", body: "Every area of the admin panel is one click away. The page you are on is highlighted." },
      { id: "facilities", route: "/admin", target: "admin.nav.facilities", title: "Facilities", body: "Every clinic with its activity, engagement health and plan, plus insights on which clinics need attention." },
      { id: "meta", route: "/admin", target: "admin.nav.meta", title: "Meta lists", body: "The options behind every dropdown in the app: facility types, staff roles, complaints, allergies, medicines and more." },
      { id: "settings", route: "/admin", target: "admin.nav.settings", title: "Settings", body: "Registration, verification codes, the free trial and pricing, and other platform-wide behaviour." },
      { id: "guidance", route: "/admin", target: "admin.nav.guidance", title: "User guidance", body: "Write, translate and publish the tours and tutorials that clinic users see." },
      { id: "account", route: "/admin", target: "admin.account", title: "Your account", body: "Your profile, password, sign-in history, activity history and **Learning & Tutorials**." },
    ],
  },
  {
    key: "admin-facilities", moduleKey: "admin.facilities", name: "Admin — facilities tour", audience: ADMIN, trigger: "first_visit",
    title: "Facilities at a glance",
    steps: [
      { id: "kpis", route: "/admin/facilities", target: "facilities.kpis", title: "Headline figures", body: "Clinics, active this week, patients, visits and revenue for the last 30 days, and trials ending soon. Click a figure to filter the list." },
      { id: "insights", route: "/admin/facilities", target: "facilities.insights", title: "Insights", body: "Clinics that need attention, such as no sign-in for 14 days, setup not finished, or visits dropping. Click one to see those clinics." },
      { id: "filters", route: "/admin/facilities", target: "facilities.filters", title: "Search and filter", body: "Search by name, contact, place or HFR number. **Filters** adds status, plan, type, location, activity and more." },
      { id: "table", route: "/admin/facilities", target: "facilities.table", title: "Every column sorts", body: "Click a heading to sort. Click a row to open the clinic. **Export CSV** saves the filtered list." },
    ],
  },
  {
    key: "admin-guidance", moduleKey: "admin.guidance", name: "Admin — guidance tour", audience: ADMIN, trigger: "first_visit",
    title: "Managing user guidance",
    steps: [
      { id: "settings", route: "/admin/guidance", target: "guidance.settings", title: "Switches and languages", body: "Turn guidance, tours or tutorials on or off for everyone, choose when tours start, and set the default and fallback languages." },
      { id: "modules", route: "/admin/guidance", target: "guidance.modules", title: "Modules", body: "Each part of the app can have tours and a tutorial. Coloured dots show each language's status. Open one to edit it." },
      { id: "publish", title: "Draft, review, publish", body: "Edits stay in a draft until you **Publish**. A translation reaches users only when it is complete and marked reviewed; until then they see the fallback language." },
    ],
  },
];

export const ADMIN_DOCS: StarterDoc[] = [
  {
    key: "doc-admin-facilities", moduleKey: "admin.facilities", name: "Admin — facilities tutorial", title: "Managing facilities",
    sections: {
      overview: "The Facilities page lists every clinic on the platform, with activity, an engagement score, plan status and insights on who needs attention.",
      purpose: "Spot clinics that need help, follow up on trials, and manage each clinic's account.",
      controls: "- **Headline figures**: click to filter\n- **Insights**: each opens the matching clinics\n- **Engagement health**: Thriving, Steady, At risk, Dormant\n- **Search and Filters**: status, verification, profile, plan, type, state, city, last sign-in, activity, staff, services, registration dates\n- **Table**: every column sorts; **Export CSV**",
      workflow: "1. Check the insights\n2. Filter to the clinics concerned\n3. Open a clinic to see its overview, then verify, suspend or edit its details and plan",
      fields: "- **Engagement score (0–100)**: recent use counts most, then visit volume, then profile, verification, payments and staff. Hover over a score to see why\n- **Plan**: free trial, Premium, expired or none",
      behaviour: "Suspending a clinic stops the owner and staff from signing in and sends them an email. Their data is kept, and reactivating sends a confirmation.",
      security: "Admin actions are recorded in your Activity History.",
      next: "See each clinic's team in [Staff](/admin/staff) and their collections in [Payments](/admin/payments).",
    },
    faqs: [
      { id: "hfr", q: "A clinic entered the wrong HFR number.", a: "Open the clinic, go to **Identity & contact**, correct it and save. Clinics can't change it themselves once saved." },
      { id: "trial", q: "How do I extend a free trial?", a: "Open the clinic, go to **Plan**, and use **Quick extend** or change the end date, then save." },
    ],
  },
  {
    key: "doc-admin-staff", moduleKey: "admin.staff", name: "Admin — staff tutorial", title: "Staff across all clinics",
    sections: {
      overview: "Every staff member of every clinic in one list, with their clinic, role, contact and status.",
      purpose: "Help clinics with their teams, and add or correct staff when asked.",
      controls: "- **Search** and filters for employee type, clinic and status\n- **Add staff**: choose the clinic, then verify the email or mobile with a code\n- Open a person to edit their details or switch them off",
      validation: "Each email or mobile number can belong to only one clinic or staff member, because they share the clinic login page. A changed contact must be verified again.",
      security: "Permissions are set by each clinic owner. Admins edit details, not a clinic's permission choices.",
      next: "Roles and their default permissions come from [Meta](/admin/meta).",
    },
    faqs: [{ id: "login", q: "A staff member can't sign in.", a: "Check they are Active, their clinic is active, and their email or mobile isn't also used by another account." }],
  },
  {
    key: "doc-admin-payments", moduleKey: "admin.payments", name: "Admin — payments tutorial", title: "Payments across all clinics",
    sections: {
      overview: "Every payment collected by every clinic, totalled after refunds, with breakdowns by clinic, collector and method.",
      purpose: "Reconcile collections and answer questions from clinics.",
      controls: "- **From / To** dates, **clinic**, **mode** and **status** filters\n- **Net collected, Received, Refunded, Cancelled**\n- **By clinic / By collector / By method**",
      behaviour: "Cancelled payments count for nothing, and refunds are taken off. Payments are never deleted.",
      next: "See each clinic's activity on [Facilities](/admin/facilities).",
    },
    faqs: [{ id: "diff", q: "Why do net and received differ?", a: "Net is what the clinic kept after refunds. Received includes amounts later refunded." }],
  },
  {
    key: "doc-admin-meta", moduleKey: "admin.meta", name: "Admin — meta lists tutorial", title: "Meta lists (dropdown options)",
    sections: {
      overview: "Meta holds the option lists behind the app's dropdowns and multi-selects, from facility types and staff roles to complaints, allergies and medicines.",
      purpose: "Keep the choices clinics see complete, correct and consistent.",
      controls: "- **Add New**: add an option\n- **Edit** and the **Active** switch: switch an option off instead of deleting it\n- **Last updated**: shown on every list\n- Usage counts show how many records use each option",
      behaviour: "Lists show A–Z everywhere, with \"Other\" or \"None\" last. Switching an option off hides it from new forms; existing records keep their value.",
      security: "New staff roles get standard permissions, which each clinic owner can adjust.",
      next: "Platform behaviour is in [Settings](/admin/settings).",
    },
    faqs: [{ id: "order", q: "Can I change the order of options?", a: "No. Lists are always A–Z, with catch-all options like \"Other\" last, so everyone finds things in the same place." }],
  },
  {
    key: "doc-admin-settings", moduleKey: "admin.settings", name: "Admin — settings tutorial", title: "Platform settings",
    sections: {
      overview: "Settings control platform-wide behaviour: the portal's name and support details, registration, verification codes, the free trial and pricing, patient defaults and vitals.",
      purpose: "Change how the whole platform behaves without code changes.",
      controls: "- **General** groups the everyday settings\n- Each setting shows a short explanation\n- Save applies the change immediately",
      fields: "- **Verification**: code expiry, resend wait, attempts, and **email codes only** (codes are never shown on screen once email delivery works)\n- **Subscription**: free-trial months and Premium price\n- **Patient defaults**: default state and city",
      security: "Changes affect every clinic at once. Change one setting at a time and check the effect.",
      next: "Guided tours and tutorials have their own settings in [User guidance](/admin/guidance).",
    },
    faqs: [],
  },
  {
    key: "doc-admin-guidance", moduleKey: "admin.guidance", name: "Admin — guidance tutorial", title: "Writing tours and tutorials",
    sections: {
      overview: "User guidance gives every clinic user guided tours and module tutorials in five languages. You write, translate and publish them here; clinic owners can only switch guidance off for their own clinic.",
      purpose: "Help new staff learn the app without needing a trainer.",
      controls: "- **Settings**: master switch, tours, tutorials, start rules, re-offer updates, default and fallback language\n- **Modules**: each part of the app, with its tours, tutorial and translation status\n- **Editor**: language tabs, steps, the element to highlight, who it's for, when it starts, tutorial sections, questions, preview, **Draft translations**, publish, version history",
      workflow: "1. Open a module, then add or open a tour or tutorial\n2. Write the English text\n3. **Draft translations**, or type the other languages yourself\n4. Have a fluent speaker check each language and tick **reviewed**\n5. **Publish**, with a short note",
      fields: "- **Formatting**: blank line for a new paragraph, \"- \" for bullets, \"1. \" for numbered steps, **bold**, and [label](/facility/…) links\n- **Who it's for**: clinic owner, all staff, or specific roles; leave it empty for everyone who can open the page\n- **Starts**: first sign-in, first visit to the page, or only when the user starts it",
      behaviour: "Users see only the published version, only for pages they can open, and steps on pages they can't open are left out. Restarting a tour only resets tour progress.",
      validation: "- English needs a title and at least one step or section before publishing\n- Published content can't be deleted; archive it instead and its history is kept",
      troubleshooting: "- **Draft translations fails**: the translation service may be out of credits; type the translation instead\n- **A step highlights nothing**: the element isn't on screen at that moment; the card shows centred instead",
      next: "Guidance button labels are translated in [Languages](/admin/languages), group \"guidance\".",
    },
    faqs: [{ id: "hindi", q: "Why do Hindi users still see English?", a: "That language isn't complete and reviewed yet. Fill in every text, tick reviewed, and publish again." }],
  },
  {
    key: "doc-admin-languages", moduleKey: "admin.languages", name: "Admin — languages tutorial", title: "Languages and translations",
    sections: {
      overview: "Turn languages on or off and manage the translated text of the public website and guidance labels: English, Hindi, Urdu, Arabic and Farsi.",
      controls: "- **Languages**: enable or disable, and set the default\n- **Translation keys**: each text with its value per language, as a draft or published\n- **Generate**: draft a translation automatically, when a translation service is set up",
      behaviour: "Only published translations show to users; anything unpublished falls back to English. Urdu, Arabic and Farsi display right to left.",
      security: "Have a fluent speaker review drafts before publishing. This matters especially for medical wording.",
      next: "Tour and tutorial content is translated in [User guidance](/admin/guidance).",
    },
    faqs: [],
  },
];
