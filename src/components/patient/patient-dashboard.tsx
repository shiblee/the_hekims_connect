"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { BrandLogo } from "@/components/brand/brand-logo";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, FileImage, ClipboardList, CalendarDays, MessageSquare,
  FileText, LogOut, Search, Bell, Heart, ChevronRight,
} from "lucide-react";
import { PatientOverview } from "./views/overview";
import { RecordsView } from "./views/records";
import { ProfileView } from "./views/profile";
import { PatientAppointmentsView } from "./views/appointments";
import { PatientMessagesView } from "./views/messages";
import { PatientPrescriptionsView } from "./views/prescriptions";

type View = "dashboard" | "records" | "profile" | "appointments" | "messages" | "prescriptions";

const NAV: { id: View; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "records", label: "My Records", icon: FileImage },
  { id: "profile", label: "Medical Profile", icon: ClipboardList },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "prescriptions", label: "Prescriptions", icon: FileText },
];

export function PatientDashboard() {
  const patient = useAppStore((s) => s.patient);
  const logout = useAppStore((s) => s.logout);
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // light unread count fetch
    fetch("/api/messages/conversations", { headers: { "x-hekim-auth": localStorage.getItem("hekims-connect-token") || "" } })
      .then((r) => r.json())
      .then((d) => setUnread((d.conversations || []).reduce((s: number, c: any) => s + c.unread, 0)))
      .catch(() => {});
  }, [view]);

  const onLogout = () => { logout(); };
  if (!patient) return null;

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
                  view === n.id ? "bg-accent text-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {n.label}
                {n.id === "messages" && unread > 0 && (
                  <Badge className="ml-auto h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">{unread}</Badge>
                )}
                {n.id === "profile" && (!patient.familyHistory || !patient.medicalHistory) && (
                  <Badge className="ml-auto h-5 px-1.5 text-[10px] bg-accent text-accent-foreground">!</Badge>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-6 px-3">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setView("appointments")}>
              <CalendarDays className="mr-2 h-4 w-4" /> Book Appointment
            </Button>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 p-2 rounded-lg">
            <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(patient.avatarColor))}>
              {initials(patient.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{patient.name}</p>
              <p className="text-xs text-muted-foreground truncate">Patient</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full mt-1 flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 glass border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-3">
            <button className="lg:hidden p-2" onClick={() => setMobileNav(true)}>
              <LayoutDashboard className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg lg:text-xl font-bold truncate">Hello, {patient.name.split(" ")[0]} 👋</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {patient.mizaj ? <>Mizaj: <span className="text-accent">{patient.mizaj}</span> · </> : null}
                {patient.bloodGroup ? `Blood ${patient.bloodGroup} · ` : ""}Your healing journey, harmonised.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="relative" onClick={() => setView("messages")}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {view === "dashboard" && <PatientOverview onNavigate={setView} />}
          {view === "records" && <RecordsView />}
          {view === "profile" && <ProfileView />}
          {view === "appointments" && <PatientAppointmentsView />}
          {view === "messages" && <PatientMessagesView />}
          {view === "prescriptions" && <PatientPrescriptionsView />}
        </main>
      </div>
    </div>
  );
}
