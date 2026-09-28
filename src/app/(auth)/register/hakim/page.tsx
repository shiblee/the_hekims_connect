import type { Metadata } from "next";
import { HakimSignup } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Register as a Hekim | The Hekim's Connect",
  description: "Register your Unani practice on The Hekim's Connect — verified with OTP.",
};

export default function HakimRegisterPage() {
  return <HakimSignup />;
}
