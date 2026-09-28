import type { Metadata } from "next";
import { StaticPageShell, StaticSection } from "@/components/shared/static-page-shell";
import { Stethoscope, Heart, ShieldCheck, Leaf } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us — The Hekim's Connect",
  description: "The story, mission and values behind The Hekim's Connect — a unified Unani medicine platform.",
};

const values = [
  { icon: Stethoscope, title: "Clinical rigor", desc: "Every Mizaj assessment, prescription and record on the platform follows classical Unani methodology, digitised without diluting it." },
  { icon: Heart, title: "Patient first", desc: "From onboarding to appointment booking, every screen is designed around what a patient actually needs in the moment." },
  { icon: ShieldCheck, title: "Privacy by default", desc: "OTP-secured accounts, access-controlled records and encrypted messaging are the baseline, not an add-on." },
  { icon: Leaf, title: "Rooted in tradition", desc: "We build for the Four Akhlat and the Four Modes of Ilaj as they are taught — not a watered-down wellness summary." },
];

export default function AboutPage() {
  return (
    <StaticPageShell
      eyebrow="About Us"
      title="Ancient wisdom, built for modern practice"
      subtitle="The Hekim's Connect exists to give Unani Hakims and their patients a single, dependable home for the whole continuum of care."
    >
      <StaticSection heading="Why we started">
        <p>
          Unani medicine has survived for centuries on the strength of the Hakim–patient
          relationship — careful Mizaj assessment, personalised formulations and continuity of
          care across many visits. What it lacked was modern infrastructure: secure records,
          real-time communication and a pharmacy that tracks itself.
        </p>
        <p>
          The Hekim&apos;s Connect was built to close that gap without changing what makes Unani
          practice work. We didn&apos;t design a generic telehealth app and relabel it — every
          screen, from the Mizaj sliders to the Ilaj classification on a prescription, was built
          around how a Hakim actually thinks and works.
        </p>
      </StaticSection>

      <StaticSection heading="What we believe">
        <div className="grid sm:grid-cols-2 gap-5 not-prose">
          {values.map((v) => (
            <div key={v.title} className="rounded-xl border border-border/50 bg-card/50 p-5">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
                <v.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-serif text-base font-semibold text-foreground mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </StaticSection>

      <StaticSection heading="Where we are today">
        <p>
          The platform connects verified Hakims with patients for consultation booking, Mizaj
          assessment, secure messaging, digital prescriptions and pharmacy stock management — all
          under one OTP-secured account. We are actively expanding into more districts and
          refining the tools Hakims have asked for directly.
        </p>
      </StaticSection>

      <StaticSection heading="Get in touch">
        <p>
          Questions, partnership enquiries or feedback on the platform are always welcome at{" "}
          <a href="mailto:care@hekims.connect" className="text-primary hover:underline">
            care@hekims.connect
          </a>
          .
        </p>
      </StaticSection>
    </StaticPageShell>
  );
}
