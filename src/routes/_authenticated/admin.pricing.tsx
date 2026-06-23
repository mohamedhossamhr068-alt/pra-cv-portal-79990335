import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getTenantPricing, updateTenantPricing } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, FileText, Briefcase, Globe2, Save, DollarSign, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: AdminPricing,
});

const CURRENCIES = [
  { code: "USD", symbol: "$", nameAr: "دولار أمريكي", nameEn: "US Dollar" },
  { code: "EGP", symbol: "ج.م", nameAr: "جنيه مصري", nameEn: "Egyptian Pound" },
  { code: "SAR", symbol: "ر.س", nameAr: "ريال سعودي", nameEn: "Saudi Riyal" },
  { code: "AED", symbol: "د.إ", nameAr: "درهم إماراتي", nameEn: "UAE Dirham" },
  { code: "EUR", symbol: "€", nameAr: "يورو", nameEn: "Euro" },
  { code: "GBP", symbol: "£", nameAr: "جنيه إسترليني", nameEn: "British Pound" },
  { code: "KWD", symbol: "د.ك", nameAr: "دينار كويتي", nameEn: "Kuwaiti Dinar" },
  { code: "QAR", symbol: "ر.ق", nameAr: "ريال قطري", nameEn: "Qatari Riyal" },
] as const;

function AdminPricing() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const getFn = useServerFn(getTenantPricing);
  const updateFn = useServerFn(updateTenantPricing);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-pricing"], queryFn: () => getFn() });

  const [cv, setCv] = useState(5);
  const [match, setMatch] = useState(1);
  const [scrape, setScrape] = useState(3);
  const [currency, setCurrency] = useState<string>("USD");
  const [planFree, setPlanFree] = useState(0);
  const [planPro, setPlanPro] = useState(29);
  const [planBusiness, setPlanBusiness] = useState(99);

  useEffect(() => {
    if (data) {
      setCv((data as any).cv_credit_cost ?? 5);
      setMatch((data as any).match_credit_cost ?? 1);
      setScrape((data as any).scrape_credit_cost ?? 3);
      setCurrency((data as any).currency ?? "USD");
      setPlanFree(Number((data as any).plan_price_free ?? 0));
      setPlanPro(Number((data as any).plan_price_pro ?? 29));
      setPlanBusiness(Number((data as any).plan_price_business ?? 99));
    }
  }, [data]);

  const currencyMeta = useMemo(() => CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0], [currency]);

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          cv_cost: cv,
          match_cost: match,
          scrape_cost: scrape,
          currency: currency as any,
          plan_free: planFree,
          plan_pro: planPro,
          plan_business: planBusiness,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-pricing"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("admin.pricingSaved"));
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.saveFailed")),
  });

  const creditItems = [
    { key: "cv", label: t("admin.cvCost"), icon: FileText, value: cv, set: setCv, desc: t("admin.cvCostDesc") },
    { key: "match", label: t("admin.matchCost"), icon: Briefcase, value: match, set: setMatch, desc: t("admin.matchCostDesc") },
    { key: "scrape", label: t("admin.scrapeCost"), icon: Globe2, value: scrape, set: setScrape, desc: t("admin.scrapeCostDesc") },
  ];

  const planItems = [
    { key: "free", label: T("الخطة المجانية", "Free Plan"), value: planFree, set: setPlanFree, badge: T("للبداية", "Starter") },
    { key: "pro", label: T("خطة Pro", "Pro Plan"), value: planPro, set: setPlanPro, badge: T("الأكثر شهرة", "Popular") },
    { key: "business", label: T("خطة Business", "Business Plan"), value: planBusiness, set: setPlanBusiness, badge: T("للفرق", "Teams") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur"><Coins className="h-6 w-6" /></div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">{t("admin.pricingEyebrow")}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.pricingTitle")}</h1>
            <p className="mt-2 text-sm opacity-90">{t("admin.pricingSub")}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("admin.loading")}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {/* Currency selector */}
          <Card className="border-border/60">
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><DollarSign className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{T("عملة العرض", "Display Currency")}</div>
                <div className="text-xs text-muted-foreground">
                  {T("هتظهر بيها كل أسعار الخطط في الصفحات الداخلية.", "All plan prices will show with this currency.")}
                </div>
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-mono me-2">{c.symbol}</span>
                      {c.code} — {ar ? c.nameAr : c.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Plan prices */}
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">{T("أسعار الخطط الشهرية", "Monthly Plan Prices")}</h2>
                <span className="text-xs text-muted-foreground">({currencyMeta.symbol} {currency})</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {planItems.map((p) => (
                  <div key={p.key} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">{p.label}</Label>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{p.badge}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-sm font-medium text-muted-foreground">{currencyMeta.symbol}</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={p.value}
                        onChange={(e) => p.set(Math.max(0, parseFloat(e.target.value || "0")))}
                        className="font-bold"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Credit costs (per action) */}
          <Card className="border-border/60">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">{T("تكلفة الكريديت لكل إجراء", "Credit cost per action")}</h2>
              </div>
              {creditItems.map((it) => (
                <div key={it.key} className="flex items-center gap-4 rounded-xl border bg-card p-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><it.icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{it.label}</div>
                    <div className="text-xs text-muted-foreground">{it.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">{t("admin.creditsField")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={it.value}
                      onChange={(e) => it.set(Math.max(0, parseInt(e.target.value || "0", 10)))}
                      className="w-24"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            size="lg"
            className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95 sm:w-auto"
          >
            <Save className="me-2 h-4 w-4" />
            {mut.isPending ? t("admin.saving") : t("admin.savePricing")}
          </Button>
        </div>
      )}
    </div>
  );
}
