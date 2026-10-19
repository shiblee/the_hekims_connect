import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent, changedFields } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { ALL_PERMISSIONS, defaultsFor, effectivePermissions, parseKeys, roleKey, type PermissionKey } from "@/lib/staff-permissions";
import { rolePermissionsFor } from "@/lib/staff-permissions-server";

const keys = (v: unknown): PermissionKey[] => (Array.isArray(v) ? ALL_PERMISSIONS.filter((k) => v.includes(k)) : []);

async function roleList(facilityId: string) {
  const section = await db.metadataSection.findFirst({ where: { key: "staff_role" }, include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } } });
  const inUse = await db.staff.findMany({ where: { facilityId }, select: { role: true }, distinct: ["role"] });
  return [...new Set([...(section?.options.map((o) => o.label) ?? []), ...inUse.map((s) => roleKey(s.role)), "Other"])];
}

/** Roles with their permissions, and every staff member's effective permissions. Owner or "Manage staff" (checked in src/proxy.ts). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = await rolePermissionsFor(auth.id, await roleList(auth.id));
  const staff = await db.staff.findMany({
    where: { facilityId: auth.id }, orderBy: { name: "asc" },
    select: { id: true, name: true, staffCode: true, role: true, designation: true, active: true, permissionGrants: true, permissionRevokes: true },
  });
  return NextResponse.json({
    roles,
    staff: staff.map((s) => {
      const role = roleKey(s.role);
      const rolePerms = roles.find((r) => r.role === role)?.permissions ?? defaultsFor(role);
      const grants = parseKeys(s.permissionGrants), revokes = parseKeys(s.permissionRevokes);
      return { id: s.id, name: s.name, staffCode: s.staffCode, role, designation: s.designation, active: s.active, grants, revokes, effective: effectivePermissions(rolePerms, grants, revokes), self: s.id === auth.staffId };
    }),
  });
}

/** Body { role, permissions } — a role's permissions; or { staffId, grants, revokes } — one person's changes; or { role, reset: true }. */
export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.staffId === "string") {
    if (b.staffId === auth.staffId) return NextResponse.json({ error: "You can't change your own permissions" }, { status: 403 });
    const s = await db.staff.findFirst({ where: { id: b.staffId, facilityId: auth.id }, select: { id: true } });
    if (!s) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    const grants = keys(b.grants), revokes = keys(b.revokes).filter((k) => !grants.includes(k));
    await db.staff.update({ where: { id: s.id }, data: { permissionGrants: JSON.stringify(grants), permissionRevokes: JSON.stringify(revokes) } });
    const who = await db.staff.findUnique({ where: { id: s.id }, select: { name: true, staffCode: true } });
    await logClinicEvent(req, auth, { action: "permissions.person_changed", summary: `Permissions for ${who?.name}: ${grants.length ? `added ${grants.join(", ")}` : "nothing added"}; ${revokes.length ? `removed ${revokes.join(", ")}` : "nothing removed"}`, entityType: "staff", entityId: s.id, entityLabel: `${who?.name} (${who?.staffCode})`, details: { grants, revokes } });
    return NextResponse.json({ ok: true });
  }
  const role = typeof b.role === "string" ? roleKey(b.role) : "";
  if (!role) return NextResponse.json({ error: "Role is required" }, { status: 400 });
  if (auth.staffId) {
    const me = await db.staff.findUnique({ where: { id: auth.staffId }, select: { role: true } });
    if (roleKey(me?.role) === role) return NextResponse.json({ error: "You can't change the permissions of your own role" }, { status: 403 });
  }
  if (b.reset) {
    await db.staffRolePermission.deleteMany({ where: { facilityId: auth.id, role } });
    await logClinicEvent(req, auth, { action: "permissions.role_changed", summary: `${role} reset to the standard permissions`, entityType: "role", entityLabel: role });
    return NextResponse.json({ ok: true });
  }
  const permissions = JSON.stringify(keys(b.permissions));
  const prev = await db.staffRolePermission.findUnique({ where: { facilityId_role: { facilityId: auth.id, role } }, select: { permissions: true } });
  const was = prev ? parseKeys(prev.permissions) : defaultsFor(role), now = keys(b.permissions);
  const added = now.filter((k) => !was.includes(k)), removed = was.filter((k) => !now.includes(k));
  await logClinicEvent(req, auth, { action: "permissions.role_changed", summary: `${role}: ${added.length ? `added ${added.join(", ")}` : ""}${added.length && removed.length ? "; " : ""}${removed.length ? `removed ${removed.join(", ")}` : ""}${!added.length && !removed.length ? "saved unchanged" : ""}`, entityType: "role", entityLabel: role, details: { added, removed } });
  await db.staffRolePermission.upsert({
    where: { facilityId_role: { facilityId: auth.id, role } },
    create: { facilityId: auth.id, role, permissions },
    update: { permissions },
  });
  return NextResponse.json({ ok: true });
}
