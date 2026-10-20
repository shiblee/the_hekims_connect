"use client";

import { createContext, Suspense, useContext, useEffect, useState } from "react";
import { LogoutConfirm } from "@/components/shared/logout-confirm";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSelector } from "@/components/shared/language-selector";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PatientReportsPanel } from "@/components/facility/reports/patient-reports-panel";
import { FlashNotice } from "@/components/shared/flash-notice";
import { canOpenPage } from "@/lib/staff-permissions";
import { HelpButton } from "@/components/guidance/help-panel";
import {
  LayoutDashboard, Activity, Pill, CalendarDays, Users, MessageSquare,
  FilePlus2, LogOut, Search, Bell, Stethoscope, Lock, ClipboardList, Wallet,
} from "lucide-react";

type Tab = "dashboard" | "reception" | "payments" | "mizaj" | "pharmacy" | "appointments" | "patients" | "messages" | "prescriptions" | "profile";

const NAV: { id: Tab; icon: any }[] = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "reception", icon: ClipboardList },
  { id: "patients", icon: Users },
  { id: "payments", icon: Wallet },
  { id: "mizaj", icon: Activity },
  { id: "pharmacy", icon: Pill },
  { id: "appointments", icon: CalendarDays },
  { id: "messages", icon: MessageSquare },
  { id: "prescriptions", icon: FilePlus2 },
];

// Visit/assessment pages (/facility/visits/...) are part of the patient
// workflow — they should highlight the Patients tab, not go unhighlighted.
const PATH_TO_TAB: Record<string, Tab> = { visits: "patients", asbab: "mizaj", tashkhees: "mizaj" };

const FacilityStatsContext = createContext<any>(null);
export function useFacilityStats() {
  return useContext(FacilityStatsContext);
}

export function FacilityShell({ children }: { children: React.ReactNode }) {
  const facility = useAppStore((s) => s.facility);
  // Signed-in staff: limited to their permissions (null = the clinic owner, everything).
  const perms = useAppStore((s) => s.permissions);
  const staff = useAppStore((s) => s.staff);
  const staffRole = useAppStore((s) => s.staffRole);
  const asStaff = !!staff && perms !== null;
  const can = (path: string) => canOpenPage(asStaff ? perms : null, path);
  const logout = useAppStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const rawSegment = pathname.split("/")[2] || "dashboard";
  const active = (PATH_TO_TAB[rawSegment] ?? rawSegment) as Tab;
  const [mobileNav, setMobileNav] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const t = useTranslations("clinic.shell");
  const tc = useTranslations("common");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/facility/stats", { headers: { "x-hekim-auth": localStorage.getItem("hekims-connect-token") || "" } });
        if (alive && res.ok) setStats(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const go = (tab: string) => { router.push(`/facility/${tab}`); setMobileNav(false); };
  const pageAllowed = can(pathname);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const onLogout = () => { logout(); router.push("/"); };

  if (!facility) return null;

  return (
    <div className="min-h-screen flex relative overflow-x-clip bg-gradient-to-br from-primary/10 via-background to-accent/5">
      <div className="pointer-events-none absolute -top-32 -start-32 h-96 w-96 rounded-full bg-primary/15 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -end-24 h-96 w-96 rounded-full bg-accent/15 blur-[100px]" />

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 start-0 z-40 h-screen w-64 shrink-0 bg-sidebar border-e border-sidebar-border flex flex-col transition-transform lg:translate-x-0 lg:rtl:translate-x-0",
        mobileNav ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
      )}>
        <div className="h-16 px-4 border-b border-sidebar-border flex items-center">
          <BrandLogo size={50} className="block" />
        </div>

        {/* Radix renders the viewport's content as display:table, which lets long
            content (e.g. a report title) widen the sidebar — force block so
            truncation works and nothing is cut off at the edge. */}
        <ScrollArea className="flex-1 px-3 py-4 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <nav className="space-y-1" data-tour="shell.nav">
            {NAV.filter((n) => can(`/facility/${n.id}`)).map((n) => (
              <button
                key={n.id}
                data-tour={`nav.${n.id}`}
                onClick={() => go(n.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active === n.id
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {t(`nav_${n.id}`)}
                {n.id === "messages" && stats?.unreadMessages > 0 && (
                  <Badge className="ms-auto h-5 px-1.5 text-[10px] bg-accent text-accent-foreground">{stats.unreadMessages}</Badge>
                )}
              </button>
            ))}
          </nav>

          {can("/facility/patients") && <div className="mt-6 px-3">
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => go("patients")}>
              <Stethoscope className="me-2 h-4 w-4" /> {t("start_consultation")}
            </Button>
          </div>}

          {/* Reports for the patient on screen (reads ?patientId — Suspense needed for useSearchParams). */}
          <Suspense fallback={null}>
            <PatientReportsPanel />
          </Suspense>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border">
          <button
            data-tour="shell.account"
            onClick={() => (asStaff ? router.push(can("/facility/profile") ? "/facility/profile" : can("/facility/profile/staff") ? "/facility/profile/staff" : "/staff") : go("profile"))}
            className={cn(
              "w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors",
              active === "profile" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent"
            )}
          >
            <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(facility.avatarColor))}>
              {initials(asStaff ? staff!.name : facility.facilityName)}
            </div>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-medium truncate">{asStaff ? staff!.name : facility.facilityName}</p>
              <p className="text-xs text-muted-foreground truncate">{asStaff ? `${staffRole ?? t("staff")} · ${facility.facilityName}` : facility.specialization}</p>
            </div>
          </button>
          <button onClick={() => setLogoutOpen(true)} className="w-full mt-1 flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4 rtl:rotate-180" /> {tc("logout")}
          </button>
        </div>
      </aside>
      <LogoutConfirm open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={onLogout} who={facility.facilityName} />

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* Main */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col lg:ms-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 glass border-b border-border">
          <div className="h-16 flex items-center gap-3 px-4 lg:px-6">
            <button className="lg:hidden p-2" aria-label={t("open_menu")} onClick={() => setMobileNav(true)}>
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg lg:text-xl font-bold truncate">
                {t("hello", { name: asStaff ? staff!.name : facility.facilityName })} 👋
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {asStaff ? `${staffRole ?? t("staff")} · ${facility.facilityName}` : `${facility.specialization} · ${t("rating", { rating: facility.rating })}`}
              </p>
            </div>
            <div className="hidden md:block relative w-56" data-tour="shell.search">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search_patients")} className="ps-9 h-9 bg-background/60" onClick={() => go("patients")} readOnly />
            </div>
            <HelpButton />
            <LanguageSelector compact />
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications")}>
              <Bell className="h-5 w-5" />
              {stats?.unreadMessages > 0 && (
                <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">
          <FacilityStatsContext.Provider value={stats}>
            <FlashNotice />
            {pageAllowed ? children : (
              <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card/70 p-8 text-center">
                <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-serif text-lg font-semibold">{tc("no_access_title")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tc("no_access_hint")}</p>
              </div>
            )}
          </FacilityStatsContext.Provider>
        </main>
      </div>
    </div>
  );
}
