import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Briefcase,
  CreditCard,
  Settings as SettingsIcon,
  Users,
  BarChart3,
  Palette,
  Building2,
  Globe2,
  Moon,
  Sun,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setLocale } from "@/lib/i18n";
import { useMeQuery } from "@/lib/me.hooks";

type NavItem = { to: string; key: string; label: string; icon: any };

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const saved = (localStorage.getItem("pra_theme") as "light" | "dark" | null) || "light";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("pra_theme", next);
  };
  return { theme, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const me = useMeQuery();

  useEffect(() => {
    const lng = i18n.language === "ar" ? "ar" : "en";
    document.documentElement.lang = lng;
    document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);

  const items: NavItem[] = [
    { to: "/dashboard", key: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/cv/new", key: "cvnew", label: t("nav.cv"), icon: Sparkles },
    { to: "/cv", key: "cv", label: t("nav.library"), icon: FileText },
    { to: "/jobs", key: "jobs", label: t("nav.jobs"), icon: Briefcase },
    { to: "/billing", key: "billing", label: t("nav.billing"), icon: CreditCard },
    { to: "/settings", key: "settings", label: t("nav.settings"), icon: SettingsIcon },
  ];

  const isAdmin = me.data?.roles?.includes("company_admin");
  const isSuper = me.data?.roles?.includes("superadmin");

  const adminItems: NavItem[] = [
    { to: "/admin/team", key: "team", label: t("nav.team"), icon: Users },
    { to: "/admin/usage", key: "usage", label: t("nav.usage"), icon: BarChart3 },
    { to: "/admin/branding", key: "branding", label: t("nav.branding"), icon: Palette },
  ];
  const superItems: NavItem[] = [
    { to: "/platform/tenants", key: "tenants", label: t("nav.tenants"), icon: Building2 },
    { to: "/platform/analytics", key: "panalytics", label: t("nav.analytics"), icon: BarChart3 },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const SidebarNav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{t("brand")}</div>
          <div className="truncate text-[11px] text-muted-foreground">{me.data?.tenant?.name ?? "—"}</div>
        </div>
      </div>

      {items.map((it) => {
        const active = pathname === it.to || (it.to !== "/dashboard" && pathname.startsWith(it.to));
        const Icon = it.icon;
        return (
          <Link
            key={it.key}
            to={it.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.admin")}
          </div>
          {adminItems.map((it) => {
            const Icon = it.icon;
            const active = pathname.startsWith(it.to);
            return (
              <Link
                key={it.key}
                to={it.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </>
      )}

      {isSuper && (
        <>
          <div className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.platform")}
          </div>
          {superItems.map((it) => {
            const Icon = it.icon;
            const active = pathname.startsWith(it.to);
            return (
              <Link
                key={it.key}
                to={it.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs">
          <div className="truncate font-medium text-sidebar-foreground">{me.data?.profile?.full_name ?? me.data?.profile?.email}</div>
          <div className="truncate text-muted-foreground">{me.data?.profile?.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-e border-sidebar-border bg-sidebar md:flex">{SidebarNav}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 border-e border-sidebar-border bg-sidebar">{SidebarNav}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-muted-foreground">{me.data?.tenant?.name}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(i18n.language === "ar" ? "en" : "ar")}
            className="gap-1.5"
          >
            <Globe2 className="h-4 w-4" />
            {i18n.language === "ar" ? "EN" : "ع"}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
