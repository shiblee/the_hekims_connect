export interface PageSeed {
  slug: string;
  title: string;
  subtitle: string;
  body: string;
}

/** Initial English content for admin-managed pages (Pages → Privacy/Terms in the admin panel). */
export const PAGES_EN: PageSeed[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    subtitle: "Last updated 21 September 2026. This explains what we collect, why, and how it's protected.",
    body: `## 1. Information we collect

**Account information:** name, email, phone number, and — for Hakims — license and specialization details, collected at signup.

**Health information:** Mizaj assessment results, medical history, allergies, chronic conditions, uploaded lab reports/scans, prescriptions and appointment notes, provided by you or your Hakim as part of care.

**Usage information:** login timestamps, device/browser type, and aggregate, non-identifying site-traffic metrics used to keep the platform reliable.

## 2. How we use it

Your data is used to operate the platform: authenticating your account, connecting you with the right Hakim or patient, powering the Mizaj and prescription tools, and securing messages between you and your care provider. We do not sell personal or health data to third parties, ever.

## 3. How it's protected

Every account is OTP-secured at login. Passwords are hashed, never stored in plain text. Access to patient records is scoped to the patient and their treating Hakim only. Messaging and uploaded records are stored with access controls enforced at the API layer, not just the interface.

## 4. Your rights

You can review and update your profile at any time from your dashboard. To request a full export or deletion of your account data, contact us at [care@hekims.connect](mailto:care@hekims.connect) — requests are processed within 30 days.

## 5. Cookies

We use a single functional cookie to avoid double-counting a visitor and to keep you signed in between visits. We do not use third-party advertising or tracking cookies.

## 6. Changes to this policy

If this policy changes materially, we'll update the date above and, for significant changes, notify account holders directly.`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    subtitle: "Last updated 21 September 2026. Please read these terms before using the platform.",
    body: `## 1. Acceptance of terms

By creating an account or using The Hekim's Connect, you agree to these terms. If you're signing up on behalf of a clinic or practice, you confirm you have authority to accept these terms for that organisation.

## 2. Who can use the platform

Hakim accounts require a valid practitioner license, verified during signup. Patient accounts are open to individuals 18 or older, or to a parent/guardian managing care on behalf of a minor.

## 3. Not a substitute for emergency care

The Hekim's Connect facilitates consultation, assessment and prescription management between you and your Hakim. It is not an emergency service. In a medical emergency, contact your local emergency services immediately.

## 4. Your responsibilities

Keep your login credentials and OTP codes confidential. Provide accurate medical history — the quality of a Mizaj assessment and any prescription depends on it. Do not use the platform to share content that is unlawful, abusive or infringes another person's rights.

## 5. Hakim obligations

Hakims are independently responsible for the clinical advice, Mizaj assessments and prescriptions they provide through the platform, and must hold a valid license to practise in their jurisdiction throughout their use of the service.

## 6. Payments

Where consultation or pharmacy fees are charged, accepted payment methods are shown at checkout. Fees are processed securely and are non-refundable once a consultation has taken place, except where required by law.

## 7. Termination

You may close your account at any time from your dashboard. We may suspend or terminate accounts that violate these terms, misuse the platform, or provide false licensing information.

## 8. Contact

Questions about these terms can be sent to [care@hekims.connect](mailto:care@hekims.connect).`,
  },
];
