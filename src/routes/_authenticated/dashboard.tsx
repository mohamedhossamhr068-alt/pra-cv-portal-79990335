import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeQuery } from "@/lib/me.client";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Briefcase, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const quota = me.data?.quota;

  const stats = [
    { label: t("dashboard.cvsThisMonth"), value: quota?.used ?? 0, icon: FileText, accent: "bg-primary/10 text-primary" },
    { label: t("dashboard.quotaRemaining"), value: quota?.remaining ?? 0, icon: Sparkles, accent: "bg-accent/15 text-accent" },
    { label: t("dashboard.teamMembers"), value: 1, icon: Users, accent: "bg-success/15 text-success" },
    { label: t("nav.jobs"), value: "—", icon: Briefcase, accent: "bg-warning/15 text-warning" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.sub")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                    <div className="mt-2 text-3xl font-bold">{s.value}</div>
                  </div>
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
