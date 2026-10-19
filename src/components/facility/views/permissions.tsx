"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PERMISSIONS, defaultsFor, effectivePermissions, type PermissionKey } from "@/lib/staff-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Loader2, RotateCcw, Save, Users, UserRound } from "lucide-react";

interface RoleRow { role: string; permissions: PermissionKey[]; customised: boolean }
interface StaffPerm { id: string; name: string; staffCode: string; role: string; designation: string | null; active: boolean; grants: PermissionKey[]; revokes: PermissionKey[]; effective: PermissionKey[]; self: boolean }

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

/** Facility → Profile → Permissions: what each role, and each person, may do in the clinic app. */
export function PermissionsView() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"roles" | "people">(params.get("staff") ? "people" : "roles");
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, PermissionKey[]>>({});
  const [people, setPeople] = useState<StaffPerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [person, setPerson] = useState<{ s: StaffPerm; on: PermissionKey[] } | null>(null);
  const msg = useNotice();

  const load = () => api.get<{ roles: RoleRow[]; staff: StaffPerm[] }>("/api/facility/staff-permissions")
    .then((r) => {
      setRoles(r.roles); setPeople(r.staff);
      setDraft(Object.fromEntries(r.roles.map((x) => [x.role, x.permissions])));
      return r;
    })
    .catch((e) => { msg.error("Permissions couldn't be loaded", `${e.message || "Network error"}.`, { retry: load }); return null; });
  useEffect(() => {
    load().then((r) => {
      const id = params.get("staff");
      const s = r?.staff.find((x) => x.id === id);
      if (s) setPerson({ s, on: s.effective });
    });
  }, []);

  const changedRoles = useMemo(() => (roles || []).filter((r) => [...(draft[r.role] || [])].sort().join() !== [...r.permissions].sort().join()), [roles, draft]);
  const toggleRole = (role: string, k: PermissionKey) => setDraft((d) => ({ ...d, [role]: d[role].includes(k) ? d[role].filter((x) => x !== k) : [...d[role], k] }));

  const saveRoles = async () => {
    setSaving(true);
    try {
      for (const r of changedRoles) await api.put("/api/facility/staff-permissions", { role: r.role, permissions: draft[r.role] });
      msg.success("Permissions saved", `${changedRoles.map((r) => r.role).join(", ")} updated. Staff in these roles get the change on their next action.`);
      await load();
    } catch (e: any) { msg.error("Permissions weren't saved", `${e.message || "Network error"}.`, { retry: saveRoles }); }
    finally { setSaving(false); }
  };
  const resetRole = async (role: string) => {
    try { await api.put("/api/facility/staff-permissions", { role, reset: true }); msg.success(`${role} reset to the standard permissions`); await load(); }
    catch (e: any) { msg.error("Couldn't reset", `${e.message || "Network error"}.`); }
  };

  const savePerson = async () => {
    if (!person) return;
    const base = roles?.find((r) => r.role === person.s.role)?.permissions ?? defaultsFor(person.s.role);
    const grants = person.on.filter((k) => !base.includes(k));
    const revokes = base.filter((k) => !person.on.includes(k));
    setSaving(true);
    try {
      await api.put("/api/facility/staff-permissions", { staffId: person.s.id, grants, revokes });
      msg.success(`${person.s.name}'s permissions saved`);
      setPerson(null); await load();
    } catch (e: any) { msg.error("Not saved", `${e.message || "Network error"}.`); }
    finally { setSaving(false); }
  };

  if (!roles) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Permissions</h2>
          <p className="text-sm text-muted-foreground">What staff can see and do when they sign in. Set it per role; adjust a person if needed. You (the clinic owner) always have full access.</p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
          {([["roles", "By role", Users], ["people", "By person", UserRound]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>
      </div>
      <NoticeSlot state={msg} />

      {tab === "roles" ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="sticky left-0 z-[2] bg-card shadow-[1px_0_0_var(--border)] min-w-[13rem] px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground"><span className="absolute inset-0 -z-10 bg-muted/40" />Permission</th>
                  {roles.map((r) => (
                    <th key={r.role} className="min-w-[6.5rem] px-2 py-2.5 text-center font-semibold">
                      <span className="block">{r.role}</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">{people.filter((p) => p.role === r.role).length} staff{r.customised ? " · custom" : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {GROUPS.map((g) => (
                  <Fragment key={g}>
                    <tr className="bg-muted/20"><td colSpan={roles.length + 1} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span className="sticky left-3">{g}</span></td></tr>
                    {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                      <tr key={p.key} className="hover:bg-muted/20">
                        <td className="sticky left-0 z-[1] bg-card shadow-[1px_0_0_var(--border)] px-3 py-2"><p className="font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.hint}</p></td>
                        {roles.map((r) => (
                          <td key={r.role} className="px-2 py-2 text-center">
                            <Checkbox checked={(draft[r.role] || []).includes(p.key)} onCheckedChange={() => toggleRole(r.role, p.key)} aria-label={`${r.role}: ${p.label}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr>
                  <td className="sticky left-0 z-[1] bg-card shadow-[1px_0_0_var(--border)] px-3 py-2 text-xs text-muted-foreground">Standard permissions</td>
                  {roles.map((r) => (
                    <td key={r.role} className="px-2 py-2 text-center">
                      {r.customised && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => resetRole(r.role)}><RotateCcw className="h-3 w-3" /> Reset</Button>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3">
            {changedRoles.length > 0 && <span className="text-xs text-muted-foreground">Unsaved changes: {changedRoles.map((r) => r.role).join(", ")}</span>}
            <Button onClick={saveRoles} disabled={saving || changedRoles.length === 0}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save permissions</Button>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2.5">Staff</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Can do</th><th className="px-3 py-2.5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((s) => (
                <tr key={s.id} className={cn("hover:bg-muted/30", !s.active && "opacity-60")}>
                  <td className="px-3 py-2.5"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.staffCode}{s.designation ? ` · ${s.designation}` : ""}{!s.active ? " · inactive" : ""}</p></td>
                  <td className="px-3 py-2.5"><Badge variant="outline">{s.role}</Badge></td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="font-medium">{s.effective.length} of {PERMISSIONS.length}</span>
                    {(s.grants.length > 0 || s.revokes.length > 0) && <span className="ml-2 text-amber-700 dark:text-amber-400">adjusted for this person (+{s.grants.length} / −{s.revokes.length})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" className="h-8 px-2" disabled={s.self} title={s.self ? "You can't change your own permissions" : undefined} onClick={() => setPerson({ s, on: s.effective })}>
                      <KeyRound className="h-3.5 w-3.5" /> Set permissions
                    </Button>
                  </td>
                </tr>
              ))}
              {people.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No staff yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!person} onOpenChange={(o) => { if (!o) setPerson(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{person?.s.name} · permissions</DialogTitle></DialogHeader>
          {person && (() => {
            const base = roles.find((r) => r.role === person.s.role)?.permissions ?? defaultsFor(person.s.role);
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Starts from the <b className="text-foreground">{person.s.role}</b> role. Ticks that differ from the role are marked.</p>
                {GROUPS.map((g) => (
                  <div key={g}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                    <div className="space-y-1">
                      {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                        const on = person.on.includes(p.key); const fromRole = base.includes(p.key);
                        return (
                          <label key={p.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 hover:bg-muted/30">
                            <Checkbox checked={on} onCheckedChange={() => setPerson((x) => x && { ...x, on: on ? x.on.filter((k) => k !== p.key) : [...x.on, p.key] })} />
                            <span className="flex-1 text-sm">{p.label}</span>
                            {on !== fromRole && <Badge variant="outline" className={on ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-red-500/40 text-red-600 dark:text-red-400"}>{on ? "added" : "removed"}</Badge>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Effective now: {effectivePermissions(base, person.on.filter((k) => !base.includes(k)), base.filter((k) => !person.on.includes(k))).length} permissions.</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => person && setPerson({ ...person, on: roles.find((r) => r.role === person.s.role)?.permissions ?? defaultsFor(person.s.role) })}><RotateCcw className="h-4 w-4" /> Same as role</Button>
            <Button onClick={savePerson} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
