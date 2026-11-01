"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, FileText, GraduationCap, Languages, LayoutTemplate, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SETTINGS_TAB_LABELS, settingsTabsFrom } from "@/lib/admin-settings-tabs";
import { NOTIFICATION_TABS } from "@/components/admin/notification-settings";

type Icon = typeof BellRing;

// Admin sections that live under Settings but keep their own pages (and sub-pages).
const CONTENT_LINKS: { href: string; label: string; icon: Icon }[] = [
  { href: "/admin/languages", label: "Languages", icon: Languages },
  { href: "/admin/guidance", label: "Guidance", icon: GraduationCap },
  { href: "/admin/pages", label: "Pages", icon: FileText },
];

function MenuGroupLabel({ icon: Icon, label }: { icon: Icon; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  );
}

function MenuItem({ icon: Icon, label, active, onClick }: { icon: Icon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
        active ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Shared shell for Settings and the sections grouped under it (Notifications,
 * Languages, Guidance, Pages): one "Settings" title and one left menu, with
 * each group under its own heading.
 */
export default function SettingsShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<string[]>([]);

  useEffect(() => {
    adminApi.get<{ settings: { category: string }[] }>("/api/admin/settings")
      .then((res) => setTabs(settingsTabsFrom(res.settings)))
      .catch(() => {});
  }, []);

  const onSettingsPage = pathname.startsWith("/admin/settings");
  const settingsTab = onSettingsPage ? pathname.split("/")[3] || null : null;
  // Inside the Settings page, pushState switches tabs without remounting it,
  // so unsaved edits on other tabs aren't lost; elsewhere it's a normal navigation.
  const openSettingsTab = (id: string) => {
    if (onSettingsPage) {
      if (id !== settingsTab) window.history.pushState(null, "", `/admin/settings/${id}`);
    } else {
      router.push(`/admin/settings/${id}`);
    }
  };
  const notificationActive = (id: string) =>
    settingsTab === id || (id === "email-templates" && pathname.startsWith("/admin/notifications/templates"));

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <Card className="p-2 border-border/50 bg-card/60 h-fit md:sticky md:top-20">
          <nav>
            <MenuGroupLabel icon={SlidersHorizontal} label="Settings" />
            <div className="space-y-1">
              {tabs.map((c) => (
                <MenuItem key={c} icon={SettingsIcon} label={SETTINGS_TAB_LABELS[c] || c} active={settingsTab === c} onClick={() => openSettingsTab(c)} />
              ))}
            </div>
            <div className="my-3 mx-1 border-t border-border" />
            <MenuGroupLabel icon={BellRing} label="Notifications" />
            <div className="space-y-1">
              {NOTIFICATION_TABS.map((n) => (
                <MenuItem key={n.id} icon={n.icon} label={n.label} active={notificationActive(n.id)} onClick={() => openSettingsTab(n.id)} />
              ))}
            </div>
            <div className="my-3 mx-1 border-t border-border" />
            <MenuGroupLabel icon={LayoutTemplate} label="Site & Content" />
            <div className="space-y-1">
              {CONTENT_LINKS.map((l) => (
                <MenuItem key={l.href} icon={l.icon} label={l.label} active={pathname.startsWith(l.href)} onClick={() => router.push(l.href)} />
              ))}
            </div>
          </nav>
        </Card>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
