import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const STARTING_COUNT = 18400;

async function getOrCreateStat() {
  const existing = await db.siteStat.findUnique({ where: { id: "visitors" } });
  if (existing) return existing;
  return db.siteStat.create({ data: { id: "visitors", count: STARTING_COUNT } });
}

export async function GET() {
  const stat = await getOrCreateStat();
  return NextResponse.json({ count: stat.count });
}

export async function POST(req: NextRequest) {
  const already = req.cookies.get("hc_visited")?.value === "1";
  const stat = already
    ? await getOrCreateStat()
    : await (async () => {
        await getOrCreateStat();
        return db.siteStat.update({ where: { id: "visitors" }, data: { count: { increment: 1 } } });
      })();

  const res = NextResponse.json({ count: stat.count });
  if (!already) {
    res.cookies.set("hc_visited", "1", { maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return res;
}
