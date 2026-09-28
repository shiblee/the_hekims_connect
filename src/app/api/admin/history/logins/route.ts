import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const events = await db.adminLoginEvent.findMany({
    where: { adminId: session.admin.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const sessionIds = events.map((e) => e.sessionId).filter((id): id is string => !!id);
  const sessions = sessionIds.length
    ? await db.adminSession.findMany({ where: { id: { in: sessionIds } } })
    : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const rows = events.map((e) => {
    const s = e.sessionId ? sessionById.get(e.sessionId) : undefined;
    return {
      id: e.id,
      createdAt: e.createdAt,
      ip: e.ip,
      browser: e.browser,
      os: e.os,
      device: e.device,
      status: e.status,
      failureReason: e.failureReason,
      logoutAt: s?.logoutAt ?? null,
      logoutType: s?.logoutType ?? null,
    };
  });

  const total = rows.length;
  const successful = rows.filter((e) => e.status === "success").length;
  const failed = total - successful;
  const lastLogin = rows.find((e) => e.status === "success")?.createdAt ?? null;
  const lastLogout = rows.find((e) => e.logoutAt)?.logoutAt ?? null;

  return NextResponse.json({ events: rows, stats: { total, successful, failed, lastLogin, lastLogout } });
}
