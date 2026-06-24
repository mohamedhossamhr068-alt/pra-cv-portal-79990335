import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useMeQuery } from "@/lib/me.hooks";
import { getTenantPricing } from "@/lib/admin.functions";
import { listActiveOffers } from "@/lib/offers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Tag } from "lucide-react";
import { fmtCairoDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/billing")({
  component: Billing,
});

const SYMBOLS: Record<string, string> = {
  USD: "$", EGP: "ج.م", SAR: "ر.س", AED: "د.إ", EUR: "€", GBP: "£", KWD: "د.ك", QAR: "ر.ق",
};

function Billing() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const currentPlan = me.data?.subscription?.plan ?? "free";
  const getPricing = useServerFn(getTenantPricing);
  const listOffersFn = useServerFn(listActiveOffers);
  const { data: pricing } = useQuery({ queryKey: ["tenant-pricing"], queryFn: () => getPricing() });
  const { data: offers = [] } = useQuery({ queryKey: ["offers-active"], queryFn: () => listOffersFn() });

  const currency = (pricing as any)?.currency ?? "EGP";
  const symbol = SYMBOLS[currency] ?? currency;
  const prices: Record<string, number> = {
    free: Number((pricing as any)?.plan_price_free ?? 0),
    pro: Number((pricing as any)?.plan_price_pro ?? 250),
    business: Number((pricing as any)?.plan_price_business ?? 500),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("billing.current")}: <span className="font-medium text-foreground capitalize">{currentPlan}</span>
        </p>
      </div>

      {offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((o: any) => (
            <Card key={o.id} className="border-primary/40 bg-[image:var(--gradient-primary)]/[0.06]">
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <Tag className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.title}</span>
                    {o.discount_percent > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{o.discount_percent}% OFF</Badge>
                    )}
                    {o.code && <Badge variant="outline" className="font-mono">{o.code}</Badge>}
                  </div>
                  {o.description && <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>}
                </div>
                {o.valid_until && (
                  <span className="text-[11px] text-muted-foreground">
                    {fmtCairoDate(o.valid_until)}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                  <span className="text-base font-medium text-muted-foreground me-1">{symbol}</span>
                  {prices[id].toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

