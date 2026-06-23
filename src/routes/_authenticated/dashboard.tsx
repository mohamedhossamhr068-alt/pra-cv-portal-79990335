import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeQuery } from "@/lib/me.hooks";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Briefcase, Users, ArrowRight, Shield, Coins, BarChart3, Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const quota = me.data?.quota;
  const isAdmin = me.data?.roles?.includes("company_admin");

  const stats = [
    { label: t("dashboard.cvsThisMonth"), value: quota?.used ?? 0, icon: FileText, accent: "bg-primary/10 text-primary" },
    { label: t("admin.credits"), value: me.data?.credits ?? 0, icon: Coins, accent: "bg-amber-500/15 text-amber-600" },
    { label: t("dashboard.quotaRemaining"), value: quota?.remaining ?? 0, icon: Sparkles, accent: "bg-accent/15 text-accent" },
    { label: t("nav.jobs"), value: "—", icon: Briefcase, accent: "bg-warning/15 text-warning" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)] sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.25em] opacity-80">{me.data?.tenant?.name ?? ""}</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">
            {t("admin.welcome", { name: me.data?.profile?.full_name ?? me.data?.profile?.email })}
          </h1>
          <p className="mt-3 max-w-2xl text-sm opacity-90 sm:text-base">{t("dashboard.sub")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/cv/new"><Button size="sm" variant="secondary" className="gap-1.5 shadow-sm"><Sparkles className="h-4 w-4" /> {t("dashboard.actionNewCv")}</Button></Link>
            <Link to="/jobs"><Button size="sm" variant="secondary" className="gap-1.5 shadow-sm"><Briefcase className="h-4 w-4" /> {t("dashboard.actionFindJobs")}</Button></Link>
            {isAdmin && (
              <Link to="/admin/users"><Button size="sm" variant="secondary" className="gap-1.5 shadow-sm"><Shield className="h-4 w-4" /> {t("admin.panel")}</Button></Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="group relative overflow-hidden border-border/60 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className="mt-2 text-3xl font-bold tracking-tight">{s.value}</div>
                  </div>
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.accent} transition-transform group-hover:scale-110`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isAdmin && (
        <Card className="border-primary/20 shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> {t("admin.tools")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("admin.toolsSub")}</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminTile to="/admin/users" icon={Users} title={t("admin.tileUsers")} desc={t("admin.tileUsersDesc")} />
            <AdminTile to="/admin/pricing" icon={Coins} title={t("admin.tilePricing")} desc={t("admin.tilePricingDesc")} />
            <AdminTile to="/admin/team" icon={Users} title={t("admin.tileTeam")} desc={t("admin.tileTeamDesc")} />
            <AdminTile to="/admin/usage" icon={BarChart3} title={t("admin.tileUsage")} desc={t("admin.tileUsageDesc")} />
            <AdminTile to="/admin/branding" icon={Palette} title={t("admin.tileBranding")} desc={t("admin.tileBrandingDesc")} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("dashboard.quickActions")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link to="/cv/new"><Button variant="outline" className="w-full justify-between gap-2">{t("dashboard.actionNewCv")} <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/jobs"><Button variant="outline" className="w-full justify-between gap-2">{t("dashboard.actionFindJobs")} <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link to="/admin/team"><Button variant="outline" className="w-full justify-between gap-2">{t("dashboard.actionInvite")} <ArrowRight className="h-4 w-4" /></Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminTile({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="ms-auto h-4 w-4 self-center text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
