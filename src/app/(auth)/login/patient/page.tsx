import type { Metadata } from "next";
import { PatientLogin } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Patient Sign In | The Hekim's Connect",
  description: "Sign in to your patient account to book appointments and message your Hekim.",
};

export default function PatientLoginPage() {
  return <PatientLogin />;
}
