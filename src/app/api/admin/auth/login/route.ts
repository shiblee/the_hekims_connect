import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { makeAdminToken, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp, parseUserAgent } from "@/lib/request-info";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;
    const ip = getClientIp(req);
    const { browser, os, device } = parseUserAgent(req.headers.get("user-agent"));

    const recordFailure = async (adminId: string | null, adminName: string, reason: string) => {
      await db.adminLoginEvent.create({
        data: { adminId: adminId ?? undefined, adminName, email: String(email || "").toLowerCase().trim(), ip, browser, os, device, status: "failed", failureReason: reason },
      });
    };

    if (!email || !password) {
      await recordFailure(null, "Unknown", "Missing email or password");
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(String(email).trim())) {
      await recordFailure(null, "Unknown", "Invalid email format");
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const admin = await db.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!admin) {
      await recordFailure(null, "Unknown", "No account with this email");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!admin.active) {
      await recordFailure(admin.id, admin.name, "Account inactive");
      return NextResponse.json({ error: "This admin account is inactive. Contact a super admin." }, { status: 403 });
    }

    if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() > Date.now()) {
      const minutesLeft = Math.ceil((new Date(admin.lockedUntil).getTime() - Date.now()) / 60000);
      await recordFailure(admin.id, admin.name, "Account locked");
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` },
        { status: 423 }
      );
    }

    const valid = verifyPassword(password, admin.password);
    if (!valid) {
      const failedAttempts = admin.failedAttempts + 1;
      const lockedOut = failedAttempts >= MAX_ATTEMPTS;
      await db.admin.update({
        where: { id: admin.id },
        data: {
          failedAttempts: lockedOut ? 0 : failedAttempts,
          lockedUntil: lockedOut ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      });
      await recordFailure(admin.id, admin.name, "Incorrect password");
      if (lockedOut) {
        return NextResponse.json(
          { error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` },
          { status: 423 }
        );
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await db.admin.update({
      where: { id: admin.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const session = await db.adminSession.create({
      data: { adminId: admin.id, ip, browser, os, device },
    });

    await db.adminLoginEvent.create({
      data: { adminId: admin.id, adminName: admin.name, email: admin.email, ip, browser, os, device, status: "success", sessionId: session.id },
    });
    await logAdminActivity(admin.id, "login", "Signed in successfully", ip);

    return NextResponse.json({
      token: makeAdminToken(admin.id, session.id),
      admin: { id: admin.id, name: admin.name, email: admin.email, avatarColor: admin.avatarColor, avatarImage: admin.avatarImage },
    });
  } catch (e) {
    console.error("Admin login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
