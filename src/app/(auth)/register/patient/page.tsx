import type { Metadata } from "next";
import { PatientSignup } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Create a Patient Account | The Hekim's Connect",
  description: "Create your patient account on The Hekim's Connect — begin your connected healing journey.",
};

export default function PatientRegisterPage() {
  return <PatientSignup />;
}
