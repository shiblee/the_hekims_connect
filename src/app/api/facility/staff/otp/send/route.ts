import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

/** Sends a code to verify a staff member's email/phone before they're added — no Staff row exists yet. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { contact, name } = body;
  if (!contact) return NextResponse.json({ error: "Contact is required" }, { status: 400 });

  const { value: normalizedContact, isEmail } = normalizeContact(contact);

  const cooldownSeconds = parseInt(await getSetting("verification", "otp_resend_cooldown_seconds", "30"), 10);
  const lastOtp = await db.otpCode.findFirst({
    where: { identifier: normalizedContact, purpose: "staff_verify" },
    orderBy: { createdAt: "desc" },
  });
  if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < cooldownSeconds * 1000) {
    const waitSeconds = Math.ceil((cooldownSeconds * 1000 - (Date.now() - new Date(lastOtp.createdAt).getTime())) / 1000);
    return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code` }, { status: 429 });
  }

  const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
  const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
  const code = generateOtp();
  await db.otpCode.create({
    data: {
      identifier: normalizedContact,
      role: "staff",
      code,
      purpose: "staff_verify",
      facilityId: auth.id,
      expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
    },
  });

  let delivered = false;
  if (isEmail) {
    const result = await sendTemplatedEmail({
      templateKey: "staff_otp_verification",
      to: normalizedContact,
      vars: {
        staff_name: (typeof name === "string" && name.trim()) || "there",
        otp: code,
        otp_validity: otpValidityMinutes,
        portal_name: portalName,
      },
      event: "otp_sent",
    });
    delivered = result.delivery === "sent";
  }

  return NextResponse.json({
    message: isEmail ? "Code sent to the staff member's email" : "Code generated for the staff member's phone",
    contact: normalizedContact,
    devOtp: delivered ? undefined : code,
  });
}
