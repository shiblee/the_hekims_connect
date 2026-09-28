import type { Metadata } from "next";
import { HakimLogin } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Hekim Sign In | The Hekim's Connect",
  description: "Sign in to your Hekim account to manage patients, Mizaj assessments and your Unani pharmacy.",
};

export default function HakimLoginPage() {
  return <HakimLogin />;
}
