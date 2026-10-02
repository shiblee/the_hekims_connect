"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, LogOut, User, ListChecks, LogIn, ChevronDown, Lock, Bell,
  Stethoscope, HeartPulse, Settings, BellRing, Languages, FileText, Database,
} from "lucide-react";
import { adminApi, restoreAdminSession } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AdminAvatar } from "@/components/admin/admin-avatar";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="animate-pulse">
        <BrandLogo size={48} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Checking your session…
      </div>
    </div>
  );
}

const navLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/facilities", label: "Facility", icon: Stethoscope },
  { href: "/admin/patients", label: "Patient", icon: HeartPulse },
  { href: "/admin/meta", label: "Meta", icon: Database },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/languages", label: "Languages", icon: Languages },
  { href: "/admin/pages", label: "Pages", icon: FileText },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAdminStore((s) => s.admin);
  const logout = useAdminStore((s) => s.logout);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    restoreAdminSession().then((a) => {
      if (!a) router.replace("/admin/login");
      setChecked(true);
    });
  }, [router]);

  const doLogout = async () => {
    try {
      await adminApi.post("/api/admin/auth/logout");
    } catch {
      // token already invalid/expired — proceed to clear locally regardless
    }
    logout();
    router.push("/admin/login");
  };

  if (!checked || !admin) return <LoadingScreen />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-3 shrink-0 min-w-0">
              <BrandLogo size={32} />
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground shrink-0">
                <LayoutDashboard className="h-3.5 w-3.5" /> Admin Panel
              </span>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger className="relative flex items-center justify-center h-9 w-9 rounded-lg hover:bg-card transition-colors outline-none text-muted-foreground hover:text-foreground">
                  <Bell className="h-4.5 w-4.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 shrink-0 rounded-lg pl-2 pr-2.5 py-1.5 hover:bg-card transition-colors outline-none">
                  <AdminAvatar name={admin.name} avatarColor={admin.avatarColor} avatarImage={admin.avatarImage} size="md" />
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium leading-tight">{admin.name}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{admin.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-2.5">
                      <AdminAvatar name={admin.name} avatarColor={admin.avatarColor} avatarImage={admin.avatarImage} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{admin.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/profile"><User className="h-4 w-4" /> Update Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/profile/password"><Lock className="h-4 w-4" /> Change Password</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/history/logins"><LogIn className="h-4 w-4" /> Login History</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/history/activity"><ListChecks className="h-4 w-4" /> Activity History</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={doLogout}>
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Horizontal nav — its own full-width row so it never wraps or collides with the logo/profile above it. */}
          <nav className="pb-3.5 -mt-0.5">
            <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/40 p-1.5 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navLinks.map((l) => {
                const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "group relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-300",
                      active
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_0_18px_oklch(0.72_0.13_175/0.4)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                    )}
                  >
                    <l.icon className={cn("h-3.5 w-3.5 transition-transform duration-300", !active && "group-hover:scale-110")} />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
