import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const records = await db.record.findMany({
    where: { patientId: auth.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled record";
    const description = (formData.get("description") as string) || "";
    const category = (formData.get("category") as string) || "General";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Limit to ~5MB
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isVideo = mimeType.startsWith("video/");
    const type = isImage ? "image" : isVideo ? "video" : "document";

    const record = await db.record.create({
      data: {
        patientId: auth.id,
        type,
        fileName: file.name,
        fileData: `data:${mimeType};base64,${base64}`,
        mimeType,
        title,
        description,
        category,
      },
    });

    return NextResponse.json({ record });
  } catch (e) {
    console.error("Record upload error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
