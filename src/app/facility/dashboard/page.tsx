"use client";

import { useRouter } from "next/navigation";
import { Overview } from "@/components/facility/views/overview";
import { useFacilityStats } from "@/components/facility/facility-shell";

export default function FacilityDashboardPage() {
  const router = useRouter();
  const stats = useFacilityStats();
  return <Overview stats={stats} onNavigate={(tab: string) => router.push(`/facility/${tab}`)} />;
}
