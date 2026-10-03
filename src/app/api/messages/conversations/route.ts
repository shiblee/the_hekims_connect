import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// List conversations for the current user
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find distinct conversation partners
  const messages = await db.message.findMany({
    where: {
      OR: [
        { senderId: auth.id, senderType: auth.type },
        { receiverId: auth.id, receiverType: auth.type },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const conversationMap = new Map<
    string,
    {
      partnerId: string;
      partnerType: string;
      lastMessage: string;
      lastAt: Date;
      unread: number;
    }
  >();

  for (const m of messages) {
    const isSender = m.senderId === auth.id && m.senderType === auth.type;
    const partnerId = isSender ? m.receiverId : m.senderId;
    const partnerType = isSender ? m.receiverType : m.senderType;
    const key = `${partnerType}|${partnerId}`;
    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        partnerId,
        partnerType,
        lastMessage: m.content,
        lastAt: m.createdAt,
        unread: 0,
      });
    }
    if (!isSender && !m.read) {
      conversationMap.get(key)!.unread += 1;
    }
  }

  // Enrich with partner info
  const conversations = await Promise.all(
    Array.from(conversationMap.values()).map(async (c) => {
      let partner: any = null;
      if (c.partnerType === "facility") {
        const f = await db.facility.findUnique({
          where: { id: c.partnerId },
          select: { id: true, facilityName: true, specialization: true, avatarColor: true },
        });
        partner = f ? { id: f.id, name: f.facilityName, specialization: f.specialization, avatarColor: f.avatarColor } : null;
      } else {
        partner = await db.patient.findUnique({
          where: { id: c.partnerId },
          select: { id: true, name: true, avatarColor: true, mizaj: true },
        });
      }
      return { ...c, partner };
    })
  );

  conversations.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  return NextResponse.json({ conversations });
}
