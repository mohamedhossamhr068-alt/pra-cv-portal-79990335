import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
      toast.success("تم حفظ الأسعار بنجاح");
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const items = [
    { key: "cv", label: "توليد السيرة الذاتية", icon: FileText, value: cv, set: setCv, desc: "تكلفة كل عملية إنشاء وتحليل CV." },
    { key: "match", label: "مطابقة وظيفة", icon: Briefcase, value: match, set: setMatch, desc: "تكلفة كل عملية مطابقة لقائمة الوظائف." },
    { key: "scrape", label: "سحب وظائف جديدة", icon: Globe2, value: scrape, set: setScrape, desc: "تكلفة كل عملية سكرابينج من المنصات الخارجية." },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border bg-[image:var(--gradient-primary)] p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-3"><Coins className="h-6 w-6" /></div>
          <div>
            <div className="text-xs uppercase tracking-widest opacity-80">Pricing Control</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">أسعار الخدمات بالرصيد</h1>
            <p className="mt-1 text-sm opacity-90">حدّد كم نقطة (Credit) تُخصم من المستخدم في كل عملية.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">جاري التحميل…</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {items.map((it) => (
            <Card key={it.key} className="transition hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-primary/10 p-3 text-primary"><it.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{it.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">الرصيد</Label>
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
            className="w-full sm:w-auto"
          >
            <Save className="ml-2 h-4 w-4" />
            {mut.isPending ? "جاري الحفظ…" : "حفظ الأسعار"}
          </Button>
        </div>
      )}
    </div>
  );
}
