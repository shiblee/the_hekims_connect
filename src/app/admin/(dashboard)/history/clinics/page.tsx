"use client";

import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { ActivityLogView } from "@/components/facility/views/activity-log";

/** Super Admin → History → Clinic Activity: every clinic's sign-ins and actions. */
export default function ClinicActivityPage() {
  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Card className="p-6 border-border/50 bg-card/60">
        <ActivityLogView client={adminApi} endpoint="/api/admin/clinic-activity" />
      </Card>
    </div>
  );
}
