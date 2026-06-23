import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getTenantPricing, updateTenantPricing } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, FileText, Briefcase, Globe2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  component: AdminPricing,
});

function AdminPricing() {
  const { t } = useTranslation();
  const getFn = useServerFn(getTenantPricing);
  const updateFn = useServerFn(updateTenantPricing);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-pricing"], queryFn: () => getFn() });

  const [cv, setCv] = useState(5);
  const [match, setMatch] = useState(1);
  const [scrape, setScrape] = useState(3);

  useEffect(() => {
    if (data) {
      setCv((data as any).cv_credit_cost ?? 5);
      setMatch((data as any).match_credit_cost ?? 1);
      setScrape((data as any).scrape_credit_cost ?? 3);
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => updateFn({ data: { cv_cost: cv, match_cost: match, scrape_cost: scrape } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-pricing"] });
      toast.success(t("admin.pricingSaved"));
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.saveFailed")),
  });

  const items = [
    { key: "cv", label: t("admin.cvCost"), icon: FileText, value: cv, set: setCv, desc: t("admin.cvCostDesc") },
    { key: "match", label: t("admin.matchCost"), icon: Briefcase, value: match, set: setMatch, desc: t("admin.matchCostDesc") },
    { key: "scrape", label: t("admin.scrapeCost"), icon: Globe2, value: scrape, set: setScrape, desc: t("admin.scrapeCostDesc") },
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
          {items.map((it) => (
            <Card key={it.key} className="group border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110"><it.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{it.label}</div>
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
              </CardContent>
            </Card>
          ))}

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
