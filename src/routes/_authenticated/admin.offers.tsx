import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Trash2, Percent, Sparkles } from "lucide-react";
import { listAllOffers, createOffer, toggleOffer, deleteOffer } from "@/lib/offers.functions";
import { fmtCairo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/admin/offers")({
  component: AdminOffers,
});

function AdminOffers() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const qc = useQueryClient();

  const listFn = useServerFn(listAllOffers);
  const createFn = useServerFn(createOffer);
  const toggleFn = useServerFn(toggleOffer);
  const deleteFn = useServerFn(deleteOffer);

  const { data: offers = [] } = useQuery({ queryKey: ["offers-all"], queryFn: () => listFn() });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState<number>(10);
  const [code, setCode] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title,
          description,
          discount_percent: discount,
          code,
          valid_until: validUntil ? new Date(validUntil).toISOString() : null,
          is_active: true,
        },
      }),
    onSuccess: () => {
      toast.success(T("تم إنشاء العرض وإرسال الإشعار للمستخدمين", "Offer created and users notified"));
      setTitle(""); setDescription(""); setDiscount(10); setCode(""); setValidUntil("");
      qc.invalidateQueries({ queryKey: ["offers-all"] });
      qc.invalidateQueries({ queryKey: ["offers-active"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offers-all"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offers-all"] }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Tag className="h-6 w-6 text-primary" />
          {T("العروض والخصومات", "Offers & Discounts")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {T("أنشئ عروض وخصومات وسيتم إشعار جميع المستخدمين تلقائيًا.", "Create promotions — users get notified instantly.")}
        </p>
      </div>

      <Card className="border-primary/30 bg-[image:var(--gradient-primary)]/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {T("عرض جديد", "New Offer")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{T("العنوان", "Title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={T("خصم رمضان", "Ramadan Sale")} />
          </div>
          <div className="md:col-span-2">
            <Label>{T("الوصف", "Description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Percent className="h-3 w-3" /> {T("نسبة الخصم", "Discount %")}</Label>
            <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div>
            <Label>{T("كود الخصم (اختياري)", "Code (optional)")}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE20" />
          </div>
          <div className="md:col-span-2">
            <Label>{T("ينتهي في (اختياري)", "Valid until (optional)")}</Label>
            <Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button
              onClick={() => create.mutate()}
              disabled={!title || create.isPending}
              className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground"
            >
              <Plus className="me-2 h-4 w-4" />
              {create.isPending ? T("جاري الإنشاء…", "Creating…") : T("إنشاء وإرسال الإشعار", "Create & Notify")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{T("جميع العروض", "All Offers")}</h2>
        {offers.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{T("لا يوجد عروض بعد", "No offers yet")}</CardContent></Card>
        )}
        {offers.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{o.title}</span>
                  {o.discount_percent > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{o.discount_percent}%</Badge>
                  )}
                  {o.code && <Badge variant="outline" className="font-mono">{o.code}</Badge>}
                  {!o.is_active && <Badge variant="outline">{T("متوقف", "Paused")}</Badge>}
                </div>
                {o.description && <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>}
                {o.valid_until && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {T("ينتهي:", "Until:")} {fmtCairo(o.valid_until)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={!!o.is_active} onCheckedChange={(v) => toggle.mutate({ id: o.id, is_active: v })} />
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(o.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
