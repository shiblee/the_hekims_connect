"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Activity, Pill, CalendarDays, Users, MessageSquare,
  FilePlus2, LogOut, Search, Bell, Stethoscope,
} from "lucide-react";

type Tab = "dashboard" | "mizaj" | "pharmacy" | "appointments" | "patients" | "messages" | "prescriptions" | "profile";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "patients", label: "Patients", icon: Users },
  { id: "mizaj", label: "Mizaj Assessment", icon: Activity },
  { id: "pharmacy", label: "Pharmacy", icon: Pill },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "prescriptions", label: "Prescriptions", icon: FilePlus2 },
];

// Visit/assessment pages (/facility/visits/...) are part of the patient
// workflow — they should highlight the Patients tab, not go unhighlighted.
const PATH_TO_TAB: Record<string, Tab> = { visits: "patients" };

const FacilityStatsContext = createContext<any>(null);
export function useFacilityStats() {
  return useContext(FacilityStatsContext);
}

export function FacilityShell({ children }: { children: React.ReactNode }) {
  const facility = useAppStore((s) => s.facility);
  const logout = useAppStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const rawSegment = pathname.split("/")[2] || "dashboard";
  const active = (PATH_TO_TAB[rawSegment] ?? rawSegment) as Tab;
  const [mobileNav, setMobileNav] = useState(false);
  const [stats, setStats] = useState<any>(null);

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
  const onLogout = () => { logout(); router.push("/"); };

  if (!facility) return null;

  return (
    <div className="min-h-screen flex relative overflow-x-hidden bg-gradient-to-br from-primary/10 via-background to-accent/5">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-accent/15 blur-[100px]" />

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0",
        mobileNav ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 px-4 border-b border-sidebar-border flex items-center">
          <BrandLogo size={50} className="block" />
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active === n.id
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {n.label}
                {n.id === "messages" && stats?.unreadMessages > 0 && (
                  <Badge className="ml-auto h-5 px-1.5 text-[10px] bg-accent text-accent-foreground">{stats.unreadMessages}</Badge>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-6 px-3">
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              <Stethoscope className="mr-2 h-4 w-4" /> Start Consultation
            </Button>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => go("profile")}
            className={cn(
              "w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors",
              active === "profile" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent"
            )}
          >
            <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(facility.avatarColor))}>
              {initials(facility.facilityName)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{facility.facilityName}</p>
              <p className="text-xs text-muted-foreground truncate">{facility.specialization}</p>
            </div>
          </button>
          <button onClick={onLogout} className="w-full mt-1 flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* Main */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 glass border-b border-border">
          <div className="h-16 flex items-center gap-3 px-4 lg:px-6">
            <button className="lg:hidden p-2" onClick={() => setMobileNav(true)}>
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg lg:text-xl font-bold truncate">
                Hello, {facility.facilityName} 👋
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {facility.specialization} · Rating {facility.rating}★
              </p>
            </div>
            <div className="hidden md:block relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patients…" className="pl-9 h-9 bg-background/60" onClick={() => go("patients")} readOnly />
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {stats?.unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">
          <FacilityStatsContext.Provider value={stats}>
            {children}
          </FacilityStatsContext.Provider>
        </main>
      </div>
    </div>
  );
}
