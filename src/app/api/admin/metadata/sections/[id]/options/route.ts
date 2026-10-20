import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

type ModelName = "facility" | "staff" | "patient" | "payment" | "vitals" | "referralDecline";

interface FieldConfig {
  model: ModelName;
  field: string;
  // JSON-stringified array column (contains-match) vs a plain single-value column (exact match).
  array?: boolean;
  // Non-nullable column — "unset" can only mean an empty string, never null.
  required?: boolean;
}

// Maps a Meta section key onto the real column it actually drives, so the
// listing's counts/percentages reflect real registered records instead of
// always counting against Facility (which only ever made sense for the
// Facility-category sections).
const FIELD_CONFIG: Record<string, FieldConfig> = {
  facility_type: { model: "facility", field: "facilityType" },
  specialization: { model: "facility", field: "specializations", array: true },
  service_diagnostic: { model: "facility", field: "services", array: true },
  service_emergency: { model: "facility", field: "services", array: true },
  service_maternal_child: { model: "facility", field: "services", array: true },
  service_other: { model: "facility", field: "services", array: true },
  staff_employee_type: { model: "staff", field: "employeeType", required: true },
  staff_specialization: { model: "staff", field: "specialization" },
  staff_qualification: { model: "staff", field: "qualification" },
  staff_designation: { model: "staff", field: "designation" },
  staff_role: { model: "staff", field: "role" },
  staff_responsibility: { model: "staff", field: "responsibilities", array: true },
  relationship: { model: "patient", field: "relationship" },
  gender: { model: "patient", field: "gender" },
  marital_status: { model: "patient", field: "maritalStatus" },
  payment_mode: { model: "payment", field: "mode", required: true },
  referral_decline_reason: { model: "referralDecline", field: "declineReason" },
};

async function countModel(model: ModelName, where: Record<string, unknown>): Promise<number> {
  switch (model) {
    case "facility": return db.facility.count({ where });
    case "staff": return db.staff.count({ where });
    case "patient": return db.patient.count({ where });
    case "payment": return db.payment.count({ where });
    case "vitals": return db.vitalSigns.count({ where });
    case "referralDecline": return db.amaDecline.count({ where });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const section = await db.metadataSection.findUnique({ where: { id }, select: { key: true } });
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const config = FIELD_CONFIG[section.key];

  const [options, total] = await Promise.all([
    db.metadataOption.findMany({ where: { sectionId: id }, orderBy: { sortOrder: "asc" } }),
    config ? countModel(config.model, {}) : Promise.resolve(0),
  ]);

  const counted = await Promise.all(options.map(async (o) => {
    if (!config) return { ...o, count: 0 };
    const where = config.array ? { [config.field]: { contains: `"${o.label}"` } } : { [config.field]: o.label };
    const count = await countModel(config.model, where);
    return { ...o, count };
  }));

  // Records that have no value at all for this field — the gap between
  // total and the sum of each option's count.
  let unsetCount = 0;
  if (config) {
    if (config.array) {
      unsetCount = await countModel(config.model, { OR: [{ [config.field]: null }, { [config.field]: "" }, { [config.field]: "[]" }] });
    } else if (config.required) {
      unsetCount = await countModel(config.model, { [config.field]: "" });
    } else {
      unsetCount = await countModel(config.model, { OR: [{ [config.field]: null }, { [config.field]: "" }] });
    }
  }

  return NextResponse.json({ options: counted, total, scope: config?.model ?? "none", unsetCount });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { label } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const maxOrder = await db.metadataOption.aggregate({ where: { sectionId: id }, _max: { sortOrder: true } });
  const option = await db.metadataOption.create({
    data: { sectionId: id, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ option });
}
