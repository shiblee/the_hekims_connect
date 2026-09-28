import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const lang = await db.language.findUnique({ where: { code } });
  if (!lang || !lang.enabled) {
    return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("NEXT_LOCALE", code, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  return res;
}
