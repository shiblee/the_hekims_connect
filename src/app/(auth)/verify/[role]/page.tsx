import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { VerifyOtp } from "@/components/auth/auth-screens";

export const metadata: Metadata = {
  title: "Verify OTP | The Hekim's Connect",
};

export default async function VerifyOtpPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "hakim" && role !== "patient") notFound();
  return <VerifyOtp role={role} />;
}
