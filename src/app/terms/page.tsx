import type { Metadata } from "next";
import { StaticPageShell, StaticSection } from "@/components/shared/static-page-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions — The Hekim's Connect",
  description: "The terms that govern use of The Hekim's Connect platform.",
};

export default function TermsPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      subtitle="Last updated 21 September 2026. Please read these terms before using the platform."
    >
      <StaticSection heading="1. Acceptance of terms">
        <p>
          By creating an account or using The Hekim&apos;s Connect, you agree to these terms. If
          you&apos;re signing up on behalf of a clinic or practice, you confirm you have authority
          to accept these terms for that organisation.
        </p>
      </StaticSection>

      <StaticSection heading="2. Who can use the platform">
        <p>
          Hekim accounts require a valid practitioner license, verified during signup. Patient
          accounts are open to individuals 18 or older, or to a parent/guardian managing care on
          behalf of a minor.
        </p>
      </StaticSection>

      <StaticSection heading="3. Not a substitute for emergency care">
        <p>
          The Hekim&apos;s Connect facilitates consultation, assessment and prescription
          management between you and your Hekim. It is not an emergency service. In a medical
          emergency, contact your local emergency services immediately.
        </p>
      </StaticSection>

      <StaticSection heading="4. Your responsibilities">
        <p>
          Keep your login credentials and OTP codes confidential. Provide accurate medical history
          — the quality of a Mizaj assessment and any prescription depends on it. Do not use the
          platform to share content that is unlawful, abusive or infringes another person&apos;s
          rights.
        </p>
      </StaticSection>

      <StaticSection heading="5. Hekim obligations">
        <p>
          Hekims are independently responsible for the clinical advice, Mizaj assessments and
          prescriptions they provide through the platform, and must hold a valid license to
          practise in their jurisdiction throughout their use of the service.
        </p>
      </StaticSection>

      <StaticSection heading="6. Payments">
        <p>
          Where consultation or pharmacy fees are charged, accepted payment methods are shown at
          checkout. Fees are processed securely and are non-refundable once a consultation has
          taken place, except where required by law.
        </p>
      </StaticSection>

      <StaticSection heading="7. Termination">
        <p>
          You may close your account at any time from your dashboard. We may suspend or terminate
          accounts that violate these terms, misuse the platform, or provide false licensing
          information.
        </p>
      </StaticSection>

      <StaticSection heading="8. Contact">
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:care@hekims.connect" className="text-primary hover:underline">
            care@hekims.connect
          </a>
          .
        </p>
      </StaticSection>
    </StaticPageShell>
  );
}
