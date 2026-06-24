import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent } from "@/components/ui/card";
import { fmtCairoDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/platform/tenants")({
  component: Tenants,
});

function Tenants() {
  const { t } = useTranslation();
  const fn = useServerFn(getPlatformAnalytics);
  const { data, isLoading, error } = useQuery({ queryKey: ["platform"], queryFn: () => fn() });
  if (error) return <p className="text-sm text-destructive">Forbidden</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("platform.tenantsTitle")}</h1>
      {isLoading ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {(data?.tenants ?? []).map((tn: any) => (
                <li key={tn.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{tn.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{tn.industry ?? "—"}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtCairoDate(tn.created_at)}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
