import type { Metadata } from "next";
import { StaffLogin } from "@/components/auth/staff-login";

export const metadata: Metadata = {
  title: "Staff Sign In | The Hekim's Connect",
  description: "Sign in to your staff account to view your profile.",
};

export default function StaffLoginPage() {
  return <StaffLogin />;
}
