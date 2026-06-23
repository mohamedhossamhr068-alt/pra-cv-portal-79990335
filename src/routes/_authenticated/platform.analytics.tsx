import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/platform/analytics")({
  component: PlatformAnalytics,
});

function PlatformAnalytics() {
  const { t } = useTranslation();
  const fn = useServerFn(getPlatformAnalytics);
  const { data, error } = useQuery({ queryKey: ["platform"], queryFn: () => fn() });
  if (error) return <p className="text-sm text-destructive">Forbidden</p>;

  const stats = [
    { label: t("platform.tenants"), value: data?.tenantCount ?? 0 },
    { label: t("platform.users"), value: data?.userCount ?? 0 },
    { label: t("platform.cvs"), value: data?.cvCount ?? 0 },
    { label: t("platform.mrr"), value: `$${data?.mrr ?? 0}` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("platform.analyticsTitle")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
