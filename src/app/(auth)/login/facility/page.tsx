import type { Metadata } from "next";
import { FacilityLogin } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Facility Sign In | The Hekim's Connect",
  description: "Sign in to your Facility account to manage patients, Mizaj assessments and your Unani pharmacy.",
};

export default function FacilityLoginPage() {
  return <FacilityLogin />;
}
