import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "hakim") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const [
    totalAppointments,
    todaysAppointments,
    completedAppointments,
    totalPatients,
    activePatients,
    totalMessages,
    unreadMessages,
    pharmacyItems,
    lowStockItems,
    mizajAssessments,
    prescriptionsCount,
  ] = await Promise.all([
    db.appointment.count({ where: { hakimId: auth.id } }),
    db.appointment.count({ where: { hakimId: auth.id, date: today } }),
    db.appointment.count({ where: { hakimId: auth.id, status: "completed" } }),
    db.patient.count(),
    db.appointment.findMany({
      where: { hakimId: auth.id },
      select: { patientId: true },
      distinct: ["patientId"],
    }),
    db.message.count({ where: { receiverId: auth.id, receiverType: "hakim" } }),
    db.message.count({ where: { receiverId: auth.id, receiverType: "hakim", read: false } }),
    db.pharmacyItem.count(),
    db.pharmacyItem.count({ where: { quantity: { lte: db.pharmacyItem.fields.reorderLevel } } }),
    db.mizajAssessment.count({ where: { hakimId: auth.id } }),
    db.prescription.count({ where: { hakimId: auth.id } }),
  ]);

  // Weekly healing progress (appointments per day for last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAppointments = await db.appointment.findMany({
    where: { hakimId: auth.id, date: { gte: weekAgo.toISOString().slice(0, 10) } },
    select: { date: true, status: true },
  });
  const weekly: { day: string; count: number; completed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const items = weekAppointments.filter((a) => a.date === ds);
    weekly.push({
      day: dayName,
      count: items.length,
      completed: items.filter((a) => a.status === "completed").length,
    });
  }

  // Mizaj distribution of patients
  const allPatients = await db.patient.findMany({ select: { mizaj: true } });
  const mizajDist: Record<string, number> = {};
  for (const p of allPatients) {
    const m = p.mizaj || "Unknown";
    mizajDist[m] = (mizajDist[m] || 0) + 1;
  }

  // Daily consultation cap progress (demo: cap 100)
  const consultationCap = 100;
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthlyCompleted = await db.appointment.count({
    where: { hakimId: auth.id, status: "completed", createdAt: { gte: monthStart } },
  });

  return NextResponse.json({
    totalAppointments,
    todaysAppointments,
    completedAppointments,
    totalPatients,
    activePatientsCount: activePatients.length,
    totalMessages,
    unreadMessages,
    pharmacyItems,
    lowStockItems,
    mizajAssessments,
    prescriptionsCount,
    weekly,
    mizajDistribution: mizajDist,
    consultationCap,
    monthlyCompleted,
    consultationProgress: Math.round((monthlyCompleted / consultationCap) * 100),
  });
}
