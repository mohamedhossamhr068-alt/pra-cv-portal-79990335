import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMeQuery } from "@/lib/me.hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  component: Billing,
});

function Billing() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const currentPlan = me.data?.subscription?.plan ?? "free";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("billing.current")}: <span className="font-medium text-foreground capitalize">{currentPlan}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["free", "pro", "business"] as const).map((id) => {
          const features = (t(`billing.features.${id}`, { returnObjects: true }) as string[]) ?? [];
          const isCurrent = currentPlan === id;
          return (
            <Card key={id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {t(`billing.plans.${id}`)}
                  {isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">CURRENT</span>
                  )}
                </CardTitle>
                <div className="text-2xl font-bold">
                  {id === "free" ? "$0" : id === "pro" ? "$29" : "$99"}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="space-y-1.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={isCurrent ? "outline" : "default"} disabled={isCurrent} className="w-full">
                  {isCurrent ? t("billing.current") : t("billing.upgrade")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="py-5 text-xs text-muted-foreground">{t("billing.stripeNote")}</CardContent>
      </Card>
    </div>
  );
}
