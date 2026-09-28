import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { AVATAR_GRADIENTS } from "@/lib/avatar";

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, avatarColor, avatarImage } = await req.json();
  const data: { name?: string; avatarColor?: string; avatarImage?: string | null } = {};
  const changes: string[] = [];

  if (name !== undefined) {
    if (!String(name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (String(name).trim().length > 80) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }
    data.name = String(name).trim();
    changes.push(`name changed to "${data.name}"`);
  }

  if (avatarColor !== undefined) {
    if (!Object.keys(AVATAR_GRADIENTS).includes(avatarColor)) {
      return NextResponse.json({ error: "Invalid avatar color" }, { status: 400 });
    }
    data.avatarColor = avatarColor;
    changes.push(`avatar color changed to "${avatarColor}"`);
  }

  if (avatarImage !== undefined) {
    if (avatarImage === null) {
      data.avatarImage = null;
      changes.push("profile photo removed");
    } else {
      if (typeof avatarImage !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(avatarImage)) {
        return NextResponse.json({ error: "Invalid image" }, { status: 400 });
      }
      if (avatarImage.length > 2_000_000) {
        return NextResponse.json({ error: "Image is too large" }, { status: 400 });
      }
      data.avatarImage = avatarImage;
      changes.push("profile photo updated");
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.admin.update({
    where: { id: session.admin.id },
    data,
    select: { id: true, name: true, email: true, avatarColor: true, avatarImage: true },
  });

  await logAdminActivity(session.admin.id, "profile_updated", changes.join(", "), getClientIp(req));

  return NextResponse.json({ admin: updated });
}
