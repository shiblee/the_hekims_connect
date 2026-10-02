"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { clearToken } from "@/lib/api";
import { BrandLogo } from "@/components/brand/brand-logo";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Activity, Pill, CalendarDays, Users, MessageSquare,
  FilePlus2, LogOut, Search, Bell, Stethoscope, Leaf, ChevronRight,
} from "lucide-react";
import { Overview } from "./views/overview";
import { MizajView } from "./views/mizaj";
import { PharmacyView } from "./views/pharmacy";
import { AppointmentsView } from "./views/appointments";
import { PatientsView } from "./views/patients";
import { MessagesView } from "./views/messages";
import { PrescriptionsView } from "./views/prescriptions";

type View = "dashboard" | "mizaj" | "pharmacy" | "appointments" | "patients" | "messages" | "prescriptions";

const NAV: { id: View; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "mizaj", label: "Mizaj Assessment", icon: Activity },
  { id: "pharmacy", label: "Pharmacy", icon: Pill },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "patients", label: "Patients", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "prescriptions", label: "Prescriptions", icon: FilePlus2 },
];

export function FacilityDashboard() {
  const facility = useAppStore((s) => s.facility);
  const logout = useAppStore((s) => s.logout);
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/facility/stats", { headers: { "x-hekim-auth": localStorage.getItem("hekims-connect-token") || "" } });
        if (active && res.ok) setStats(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const onLogout = () => { clearToken(); logout(); };

  if (!facility) return null;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0",
        mobileNav ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-sidebar-border">
          <BrandLogo size={34} />
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => { setView(n.id); setMobileNav(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  view === n.id
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
          <button onClick={() => setView("patients")} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(facility.avatarColor))}>
              {initials(facility.name)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{facility.name}</p>
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 glass border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-3">
            <button className="lg:hidden p-2" onClick={() => setMobileNav(true)}>
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg lg:text-xl font-bold truncate">
                Hello, {facility.name} 👋
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {facility.specialization} · Rating {facility.rating}★
              </p>
            </div>
            <div className="hidden md:block relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patients…" className="pl-9 h-9 bg-background/60" onClick={() => setView("patients")} readOnly />
            </div>
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
          {view === "dashboard" && <Overview stats={stats} onNavigate={setView} />}
          {view === "mizaj" && <MizajView />}
          {view === "pharmacy" && <PharmacyView />}
          {view === "appointments" && <AppointmentsView />}
          {view === "patients" && <PatientsView />}
          {view === "messages" && <MessagesView />}
          {view === "prescriptions" && <PrescriptionsView />}
        </main>
      </div>
    </div>
  );
}
