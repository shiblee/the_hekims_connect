import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_TYPES = ["single_select", "multi_select", "numeric", "text", "instruction"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id: moduleId } = await params;
  const body = await req.json();
  const {
    label, labelLocal, instructionText, type, applicableGender, minAgeDays, maxAgeDays,
    numericOperator, numericThreshold, numericFlagSeverity,
    numericOperator2, numericThreshold2, numericFlagSeverity2,
    options,
  } = body;

  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
  }

  const maxOrder = await db.screeningQuestion.aggregate({ where: { moduleId }, _max: { sortOrder: true } });
  const optionList = Array.isArray(options) ? options : [];

  const question = await db.screeningQuestion.create({
    data: {
      moduleId, label: String(label).trim(), labelLocal: labelLocal || null,
      instructionText: instructionText || null, type,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      applicableGender: applicableGender || null,
      minAgeDays: minAgeDays === "" || minAgeDays == null ? null : parseInt(minAgeDays, 10),
      maxAgeDays: maxAgeDays === "" || maxAgeDays == null ? null : parseInt(maxAgeDays, 10),
      numericOperator: numericOperator || null,
      numericThreshold: numericThreshold === "" || numericThreshold == null ? null : parseFloat(numericThreshold),
      numericFlagSeverity: numericFlagSeverity || null,
      numericOperator2: numericOperator2 || null,
      numericThreshold2: numericThreshold2 === "" || numericThreshold2 == null ? null : parseFloat(numericThreshold2),
      numericFlagSeverity2: numericFlagSeverity2 || null,
      options: {
        create: optionList.map((o: { label: string; labelLocal?: string; flagSeverity?: string }, idx: number) => ({
          label: o.label, labelLocal: o.labelLocal || null, flagSeverity: o.flagSeverity || null, sortOrder: idx,
        })),
      },
    },
    include: { options: true },
  });

  return NextResponse.json({ question });
}
