import { db } from "@/lib/db";
import { defaultsFor, effectivePermissions, parseKeys, roleKey, type PermissionKey } from "@/lib/staff-permissions";

export interface StaffAccess { staffId: string; facilityId: string; role: string; permissions: PermissionKey[] }

/** A staff member's clinic and effective permissions; null when the staff member or their clinic is inactive. */
export async function loadStaffAccess(staffId: string): Promise<StaffAccess | null> {
  const s = await db.staff.findUnique({
    where: { id: staffId },
    select: { active: true, facilityId: true, role: true, permissionGrants: true, permissionRevokes: true, facility: { select: { active: true } } },
  });
  if (!s || !s.active || !s.facility.active) return null;
  const role = roleKey(s.role);
  const row = await db.staffRolePermission.findUnique({ where: { facilityId_role: { facilityId: s.facilityId, role } }, select: { permissions: true } });
  const rolePerms = row ? parseKeys(row.permissions) : defaultsFor(role);
  return { staffId, facilityId: s.facilityId, role, permissions: effectivePermissions(rolePerms, parseKeys(s.permissionGrants), parseKeys(s.permissionRevokes)) };
}

/** Every role's permissions for a clinic (saved, or the defaults). */
export async function rolePermissionsFor(facilityId: string, roles: string[]) {
  const rows = await db.staffRolePermission.findMany({ where: { facilityId }, select: { role: true, permissions: true, updatedAt: true } });
  return roles.map((role) => {
    const row = rows.find((r) => r.role === role);
    return { role, permissions: row ? parseKeys(row.permissions) : defaultsFor(role), customised: !!row, updatedAt: row?.updatedAt ?? null };
  });
}
