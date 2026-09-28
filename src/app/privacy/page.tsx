import type { Metadata } from "next";
import { StaticPageShell, StaticSection } from "@/components/shared/static-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — The Hekim's Connect",
  description: "How The Hekim's Connect collects, uses, stores and protects your data.",
};

export default function PrivacyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="Last updated 21 September 2026. This explains what we collect, why, and how it's protected."
    >
      <StaticSection heading="1. Information we collect">
        <p>
          <strong>Account information:</strong> name, email, phone number, and — for Hakims —
          license and specialization details, collected at signup.
        </p>
        <p>
          <strong>Health information:</strong> Mizaj assessment results, medical history,
          allergies, chronic conditions, uploaded lab reports/scans, prescriptions and appointment
          notes, provided by you or your Hakim as part of care.
        </p>
        <p>
          <strong>Usage information:</strong> login timestamps, device/browser type, and
          aggregate, non-identifying site-traffic metrics used to keep the platform reliable.
        </p>
      </StaticSection>

      <StaticSection heading="2. How we use it">
        <p>
          Your data is used to operate the platform: authenticating your account, connecting you
          with the right Hakim or patient, powering the Mizaj and prescription tools, and securing
          messages between you and your care provider. We do not sell personal or health data to
          third parties, ever.
        </p>
      </StaticSection>

      <StaticSection heading="3. How it's protected">
        <p>
          Every account is OTP-secured at login. Passwords are hashed, never stored in plain text.
          Access to patient records is scoped to the patient and their treating Hakim only.
          Messaging and uploaded records are stored with access controls enforced at the API
          layer, not just the interface.
        </p>
      </StaticSection>

      <StaticSection heading="4. Your rights">
        <p>
          You can review and update your profile at any time from your dashboard. To request a
          full export or deletion of your account data, contact us at{" "}
          <a href="mailto:care@hekims.connect" className="text-primary hover:underline">
            care@hekims.connect
          </a>{" "}
          — requests are processed within 30 days.
        </p>
      </StaticSection>

      <StaticSection heading="5. Cookies">
        <p>
          We use a single functional cookie to avoid double-counting a visitor and to keep you
          signed in between visits. We do not use third-party advertising or tracking cookies.
        </p>
      </StaticSection>

      <StaticSection heading="6. Changes to this policy">
        <p>
          If this policy changes materially, we&apos;ll update the date above and, for
          significant changes, notify account holders directly.
        </p>
      </StaticSection>
    </StaticPageShell>
  );
}
