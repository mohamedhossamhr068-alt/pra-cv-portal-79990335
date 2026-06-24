import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getPlatformPricing } from "@/lib/admin.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PRA Career Portal" },
      { name: "description", content: "Free, Pro, and Business plans for AI-powered HR teams and recruiters." },
      { property: "og:title", content: "Pricing — PRA Career Portal" },
      { property: "og:description", content: "Transparent enterprise SaaS pricing." },
    ],
  }),
  component: Pricing,
});

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EGP: "ج.م", SAR: "ر.س", AED: "د.إ", EUR: "€", GBP: "£", KWD: "د.ك", QAR: "ر.ق",
};

function formatPrice(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const n = Number(amount ?? 0);
  const pretty = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  // Symbol-first for Latin currencies, code-after for Arabic ones
  if (["USD", "EUR", "GBP"].includes(currency)) return `${sym}${pretty}`;
  return `${pretty} ${sym}`;
}

function Pricing() {
  const { t } = useTranslation();
  const getPricing = useServerFn(getPlatformPricing);
  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: () => getPricing(),
    staleTime: 30_000,
  });
  const currency = pricing?.currency ?? "USD";
  const tiers = [
    { id: "free" as const, price: Number(pricing?.plan_price_free ?? 0), popular: false },
    { id: "pro" as const, price: Number(pricing?.plan_price_pro ?? 29), popular: true },
    { id: "business" as const, price: Number(pricing?.plan_price_business ?? 99), popular: false },
  ];
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-3 text-muted-foreground">Scale from solo to enterprise.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => {
            const features = (t(`billing.features.${tier.id}`, { returnObjects: true }) as string[]) ?? [];
            return (
              <Card
                key={tier.id}
                className={tier.popular ? "border-primary shadow-[var(--shadow-elegant)]" : ""}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {t(`billing.plans.${tier.id}`)}
                    {tier.popular && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        POPULAR
                      </span>
                    )}
                  </CardTitle>
                  <div className="text-3xl font-bold">
                    {formatPrice(tier.price, currency)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                      Get started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">{t("billing.stripeNote")}</p>
      </div>
    </div>
  );
}
