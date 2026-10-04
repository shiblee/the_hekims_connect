"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand/brand-logo";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Mail, Phone } from "lucide-react";

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Minimal staff-facing portal — just their own profile, since there's no
 * staff-specific clinical feature set yet to gate behind role/responsibility.
 */
export function StaffPortal() {
  const router = useRouter();
  const staff = useAppStore((s) => s.staff);
  const logout = useAppStore((s) => s.logout);
  const onLogout = () => { logout(); router.push("/"); };

  if (!staff) return null;

  const responsibilities = parseList(staff.responsibilities);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5">
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <BrandLogo size={30} />
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <EntityAvatar name={staff.name} photo={staff.photo} size="lg" />
          <div>
            <h1 className="font-serif text-2xl font-bold">{staff.name}</h1>
            <p className="text-sm text-muted-foreground">{staff.staffCode} · {staff.facility.facilityName}</p>
          </div>
        </div>

        <Card className="p-6 border-border/50 bg-card/60 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Professional Information</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Employee Type</dt>
              <dd className="font-medium mt-0.5">{staff.employeeType}</dd>
            </div>
            {staff.specialization && (
              <div>
                <dt className="text-muted-foreground">Specialization</dt>
                <dd className="font-medium mt-0.5">{staff.specialization}</dd>
              </div>
            )}
            {staff.qualification && (
              <div>
                <dt className="text-muted-foreground">Qualification</dt>
                <dd className="font-medium mt-0.5">{staff.qualification}</dd>
              </div>
            )}
            {staff.designation && (
              <div>
                <dt className="text-muted-foreground">Designation</dt>
                <dd className="font-medium mt-0.5">{staff.designation}</dd>
              </div>
            )}
            {staff.registrationNumber && (
              <div>
                <dt className="text-muted-foreground">Registration Number</dt>
                <dd className="font-medium mt-0.5">{staff.registrationNumber}</dd>
              </div>
            )}
            {staff.experience !== null && (
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd className="font-medium mt-0.5">{staff.experience} year{staff.experience === 1 ? "" : "s"}</dd>
              </div>
            )}
            {staff.role && (
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium mt-0.5">{staff.role}</dd>
              </div>
            )}
          </dl>
        </Card>

        {responsibilities.length > 0 && (
          <Card className="p-6 border-border/50 bg-card/60 space-y-3">
            <h2 className="font-serif text-lg font-semibold">Responsibilities</h2>
            <div className="flex flex-wrap gap-1.5">
              {responsibilities.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
            </div>
          </Card>
        )}

        <Card className="p-6 border-border/50 bg-card/60 space-y-3">
          <h2 className="font-serif text-lg font-semibold">Contact</h2>
          {staff.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {staff.email}</p>}
          {staff.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> {staff.phone}</p>}
        </Card>
      </main>
    </div>
  );
}
