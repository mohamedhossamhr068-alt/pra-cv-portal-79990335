import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTenantAnalytics } from "@/lib/analytics.functions";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  component: Usage,
});

function Usage() {
  const { t } = useTranslation();
  const fn = useServerFn(getTenantAnalytics);
  const { data } = useQuery({ queryKey: ["tenant-analytics"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.usageTitle")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{t("platform.cvs")}</div><div className="mt-2 text-3xl font-bold">{data?.totalCvs ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{t("platform.users")}</div><div className="mt-2 text-3xl font-bold">{data?.totalUsers ?? 0}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">CV generations (last 30d)</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data?.byDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">By template</CardTitle></CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data?.byTemplate ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="template" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
