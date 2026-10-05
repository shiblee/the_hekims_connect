import { db } from "@/lib/db";

// Full complaint → module → question → option tree, in one shape shared by
// the admin builder (which edits it) and the facility runner (which reads it
// to render the dynamic form and to compute flags at submit time).
export async function getScreeningConfig() {
  const [complaints, modules] = await Promise.all([
    db.chiefComplaint.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, key: true, label: true, labelLocal: true, category: true, sortOrder: true, active: true },
    }),
    db.screeningModule.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, key: true, label: true, sortOrder: true, active: true,
        triggers: { select: { chiefComplaintId: true } },
        questions: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, label: true, labelLocal: true, instructionText: true, type: true,
            sortOrder: true, active: true, applicableGender: true, minAgeDays: true, maxAgeDays: true,
            numericOperator: true, numericThreshold: true, numericFlagSeverity: true,
            numericOperator2: true, numericThreshold2: true, numericFlagSeverity2: true,
            options: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, labelLocal: true, sortOrder: true, flagSeverity: true } },
          },
        },
      },
    }),
  ]);

  return {
    complaints,
    modules: modules.map((m) => ({ ...m, triggerComplaintIds: m.triggers.map((t) => t.chiefComplaintId), triggers: undefined })),
  };
}

export type ScreeningConfig = Awaited<ReturnType<typeof getScreeningConfig>>;
