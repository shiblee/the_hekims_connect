"use client";

import { useRouter } from "next/navigation";
import { PatientOverview } from "@/components/patient/views/overview";

export default function PatientDashboardPage() {
  const router = useRouter();
  return <PatientOverview onNavigate={(tab: string) => router.push(`/patient/${tab}`)} />;
}
