import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_TYPES = ["single_select", "multi_select", "numeric", "text", "instruction"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.label !== undefined) {
    if (!String(body.label).trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
    data.label = String(body.label).trim();
  }
  if (body.labelLocal !== undefined) data.labelLocal = body.labelLocal || null;
  if (body.instructionText !== undefined) data.instructionText = body.instructionText || null;
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
    data.type = body.type;
  }
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);
  if (body.applicableGender !== undefined) data.applicableGender = body.applicableGender || null;
  if (body.minAgeDays !== undefined) data.minAgeDays = body.minAgeDays === "" || body.minAgeDays == null ? null : parseInt(body.minAgeDays, 10);
  if (body.maxAgeDays !== undefined) data.maxAgeDays = body.maxAgeDays === "" || body.maxAgeDays == null ? null : parseInt(body.maxAgeDays, 10);
  if (body.numericOperator !== undefined) data.numericOperator = body.numericOperator || null;
  if (body.numericThreshold !== undefined) data.numericThreshold = body.numericThreshold === "" || body.numericThreshold == null ? null : parseFloat(body.numericThreshold);
  if (body.numericFlagSeverity !== undefined) data.numericFlagSeverity = body.numericFlagSeverity || null;
  if (body.numericOperator2 !== undefined) data.numericOperator2 = body.numericOperator2 || null;
  if (body.numericThreshold2 !== undefined) data.numericThreshold2 = body.numericThreshold2 === "" || body.numericThreshold2 == null ? null : parseFloat(body.numericThreshold2);
  if (body.numericFlagSeverity2 !== undefined) data.numericFlagSeverity2 = body.numericFlagSeverity2 || null;

  // Options are replaced wholesale when provided — same reasoning as module triggers.
  if (Array.isArray(body.options)) {
    await db.screeningOption.deleteMany({ where: { questionId: id } });
    if (body.options.length) {
      await db.screeningOption.createMany({
        data: body.options.map((o: { label: string; labelLocal?: string; flagSeverity?: string }, idx: number) => ({
          questionId: id, label: o.label, labelLocal: o.labelLocal || null, flagSeverity: o.flagSeverity || null, sortOrder: idx,
        })),
      });
    }
  }

  const question = await db.screeningQuestion.update({ where: { id }, data, include: { options: true } });
  return NextResponse.json({ question });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await db.screeningQuestion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
