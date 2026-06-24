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
  MessageCircle,
  Coins,
  UserCheck,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setLocale } from "@/lib/i18n";
import { useMeQuery, hasFeature, type FeatureFlag } from "@/lib/me.hooks";
import { NotificationBell } from "@/components/notification-bell";
import { CairoClock } from "@/components/cairo-clock";

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

  // Route-level RBAC: block non-admins from /admin/* and non-superadmins from
  // /platform/* and /admin/approvals (URL-typed access — sidebar already hides links).
  const roles = me.data?.roles ?? [];
  const _isAdmin = roles.includes("company_admin");
  const _isSuper = roles.includes("superadmin");
  useEffect(() => {
    if (me.isLoading || !me.data) return;
    const isSuperOnly = pathname.startsWith("/platform/") || pathname.startsWith("/admin/approvals");
    if (isSuperOnly && !_isSuper) { navigate({ to: "/dashboard", replace: true }); return; }
    const _canReviewTopups = !!(me.data as any)?.permissions?.includes("review_topups");
    const _reviewPath = pathname.startsWith("/admin/wallet") || pathname.startsWith("/admin/chat/credit");
    if (pathname.startsWith("/admin/") && !_isAdmin && !_isSuper && !(_canReviewTopups && _reviewPath)) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    const _isMod = me.data.roles?.includes("moderator");
    const _privileged = !!(_isAdmin || _isSuper || _isMod);
    if (_privileged) return;
    const _flags = (me.data.profile as any)?.feature_flags as Record<string, boolean> | undefined;
    if (!_flags) return;
    const gate = (path: string, key: string) => pathname.startsWith(path) && _flags[key] === false;
    if (
      gate("/cv/new", "cv_builder") ||
      (pathname === "/cv" || pathname.startsWith("/cv/")) && _flags["cv_library"] === false && !pathname.startsWith("/cv/new") ||
      gate("/jobs", "jobs") ||
      (pathname === "/billing" && _flags["billing"] === false) ||
      gate("/billing/topup", "topup") ||
      gate("/settings", "settings") ||
      gate("/chat/support", "chat_support")
    ) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [pathname, me.isLoading, me.data, _isAdmin, _isSuper, navigate]);



  const flags = (me.data?.profile as any)?.feature_flags as Record<string, boolean> | undefined;
  const isAdmin = me.data?.roles?.includes("company_admin");
  const isSuper = me.data?.roles?.includes("superadmin");
  const isMod = me.data?.roles?.includes("moderator");
  const privileged = !!(isAdmin || isSuper || isMod);
  const allow = (k: FeatureFlag) => privileged || hasFeature(flags, k);

  const rawItems: (NavItem & { flag?: FeatureFlag })[] = [
    { to: "/dashboard", key: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/cv/new", key: "cvnew", label: t("nav.cv"), icon: Sparkles, flag: "cv_builder" },
    { to: "/cv", key: "cv", label: t("nav.library"), icon: FileText, flag: "cv_library" },
    { to: "/jobs", key: "jobs", label: t("nav.jobs"), icon: Briefcase, flag: "jobs" },
    { to: "/billing", key: "billing", label: t("nav.billing"), icon: CreditCard, flag: "billing" },
    { to: "/billing/topup", key: "topup", label: i18n.language === "ar" ? "شحن رصيد" : "Top up", icon: CreditCard, flag: "topup" },
    { to: "/billing/history", key: "billing-history", label: i18n.language === "ar" ? "سجل الشحنات" : "Top-up history", icon: Receipt, flag: "topup" },
    { to: "/chat/credit", key: "chat-credit", label: i18n.language === "ar" ? "طلب كرديت" : "Request credits", icon: Coins },
    { to: "/settings", key: "settings", label: t("nav.settings"), icon: SettingsIcon, flag: "settings" },
    { to: "/chat/support", key: "chat-support", label: i18n.language === "ar" ? "الدعم" : "Support", icon: MessageCircle, flag: "chat_support" },
  ];
  const items: NavItem[] = rawItems.filter((it) => !it.flag || allow(it.flag));


  const adminItems: NavItem[] = [
    { to: "/admin/users", key: "users", label: t("admin.tileUsers"), icon: Users },
    { to: "/admin/access", key: "access", label: i18n.language === "ar" ? "صلاحيات الواجهة" : "Access control", icon: ShieldCheck },

    { to: "/admin/pricing", key: "pricing", label: t("admin.tilePricing"), icon: SettingsIcon },
    { to: "/admin/offers", key: "offers", label: i18n.language === "ar" ? "العروض والخصومات" : "Offers", icon: Sparkles },
    { to: "/admin/wallet", key: "wallet", label: i18n.language === "ar" ? "محفظة فودافون" : "Wallet", icon: CreditCard },
    { to: "/admin/team", key: "team", label: t("nav.team"), icon: Users },
    { to: "/admin/usage", key: "usage", label: t("nav.usage"), icon: BarChart3 },
    { to: "/admin/branding", key: "branding", label: t("nav.branding"), icon: Palette },
    { to: "/admin/chat/guests", key: "chat-guests", label: i18n.language === "ar" ? "محادثات الزوار" : "Visitor inbox", icon: MessageCircle },
    { to: "/admin/chat/support", key: "chat-sup", label: i18n.language === "ar" ? "محادثات الدعم" : "Support inbox", icon: MessageCircle },
    { to: "/admin/chat/credit", key: "chat-cr", label: i18n.language === "ar" ? "طلبات الكرديت" : "Credit requests", icon: Coins },
  ];
  const canReviewTopups = !!(isAdmin || isSuper || (me.data as any)?.permissions?.includes("review_topups"));
  const visibleAdminItems = isAdmin ? adminItems : canReviewTopups ? adminItems.filter((it) => it.to === "/admin/wallet" || it.to === "/admin/chat/credit") : [];
  const superItems: NavItem[] = [
    { to: "/admin/approvals", key: "approvals", label: i18n.language === "ar" ? "طلبات الانضمام" : "Approvals", icon: UserCheck },
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

      {visibleAdminItems.length > 0 && (
        <>
          <div className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.admin")}
          </div>
          {visibleAdminItems.map((it) => {
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
          {typeof me.data?.credits === "number" && (
            <div className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs sm:flex">
              <span className="text-amber-500">●</span>
              <span className="font-semibold">{me.data.credits}</span>
              <span className="text-muted-foreground">{t("jobs.creditsLabel")}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocale(i18n.language === "ar" ? "en" : "ar")}
            className="gap-1.5 font-semibold"
            aria-label="Toggle language"
          >
            <Globe2 className="h-4 w-4" />
            {i18n.language === "ar" ? "English" : "العربية"}
          </Button>
          <CairoClock ar={i18n.language === "ar"} />
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
