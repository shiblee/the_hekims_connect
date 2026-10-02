import type { Metadata } from "next";
import { FacilitySignup } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Register your Facility | The Hekim's Connect",
  description: "Register your Unani facility on The Hekim's Connect — verified with OTP.",
};

export default function FacilityRegisterPage() {
  return <FacilitySignup />;
}
