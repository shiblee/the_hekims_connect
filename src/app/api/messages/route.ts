import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// GET messages between current user and a partner (?partnerId=&partnerType=)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get("partnerId");
  const partnerType = searchParams.get("partnerType");

  if (!partnerId || !partnerType) {
    return NextResponse.json({ error: "partnerId and partnerType required" }, { status: 400 });
  }

  const messages = await db.message.findMany({
    where: {
      OR: [
        { senderId: auth.id, senderType: auth.type, receiverId: partnerId, receiverType: partnerType },
        { senderId: partnerId, senderType: partnerType, receiverId: auth.id, receiverType: auth.type },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Mark received messages as read
  await db.message.updateMany({
    where: { senderId: partnerId, senderType: partnerType, receiverId: auth.id, receiverType: auth.type, read: false },
    data: { read: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { receiverId, receiverType, content } = body;
    if (!receiverId || !receiverType || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        senderId: auth.id,
        senderType: auth.type,
        receiverId,
        receiverType,
        content,
      },
    });

    return NextResponse.json({ message });
  } catch (e) {
    console.error("Message create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
