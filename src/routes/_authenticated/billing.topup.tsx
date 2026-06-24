import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  createTopupRequestV2,
  listMyTopups,
  getWalletSettings,
  listPaymentMethods,
  getScreenshotUrl,
} from "@/lib/wallet.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Copy, CheckCircle2, Clock, XCircle, Coins, ImageIcon, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useMeQuery } from "@/lib/me.hooks";
import { PaymentMethodIcon, PAYMENT_TYPE_META } from "@/components/payment-method-icon";
import { fmtCairo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/billing/topup")({
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
    amount: s.amount != null && !Number.isNaN(Number(s.amount)) ? Number(s.amount) : undefined,
  }),
  component: TopupPage,
});


function TopupPage() {
  const { i18n: i } = useTranslation();
  const ar = i.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const me = useMeQuery();
  const qc = useQueryClient();
  const walletFn = useServerFn(getWalletSettings);
  const createFn = useServerFn(createTopupRequestV2);
  const listFn = useServerFn(listMyTopups);
  const methodsFn = useServerFn(listPaymentMethods);
  const urlFn = useServerFn(getScreenshotUrl);

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const { data: history } = useQuery({ queryKey: ["my-topups"], queryFn: () => listFn() });
  const { data: methods } = useQuery({ queryKey: ["payment-methods"], queryFn: () => methodsFn() });

  const activeMethods = useMemo(() => (methods ?? []).filter((m: any) => m.is_active), [methods]);

  // Legacy fallback: if no payment_methods rows but a vodafone number exists, expose a synthetic one.
  const fallbackMethods = useMemo(() => {
    if (activeMethods.length > 0) return activeMethods;
    const num = (wallet as any)?.vodafone_number;
    if (!num) return [];
    return [{
      id: "__legacy_vodafone__",
      type: "vodafone_cash",
      label: T("فودافون كاش", "Vodafone Cash"),
      account_number: num,
      instructions: (wallet as any)?.instructions || "",
    }];
  }, [activeMethods, wallet, ar]);

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(
    () => fallbackMethods.find((m: any) => m.id === selectedId) ?? fallbackMethods[0],
    [fallbackMethods, selectedId],
  );

  const search = Route.useSearch();
  const [amount, setAmount] = useState<number>(search.amount && search.amount > 0 ? search.amount : 50);

  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const rate = Number((wallet as any)?.credits_per_egp ?? 1);
  const expectedCredits = Math.max(1, Math.floor((amount || 0) * rate));

  const mut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error(T("اختر وسيلة الدفع", "Select a payment method"));
      if (!file) throw new Error(T("ارفع صورة التحويل أولاً", "Upload the transfer screenshot first"));
      if (!amount || amount <= 0) throw new Error(T("أدخل المبلغ", "Enter amount"));
      setUploading(true);
      const userId = me.data?.profile?.id;
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("topup-screenshots").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;
      return createFn({ data: {
        amount_egp: amount,
        reference_number: ref,
        screenshot_path: path,
        payment_method_id: selected.id.startsWith("__legacy") ? null : selected.id,
      }});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-topups"] });
      toast.success(T("تم إرسال الطلب — سيتم مراجعته قريبًا", "Request sent — pending review"));
      setFile(null); setFilePreview(null); setRef(""); setAmount(50);
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
    onSettled: () => setUploading(false),
  });

  function onFileChange(f: File | null) {
    setFile(f);
    setFilePreview(f ? URL.createObjectURL(f) : null);
  }

  async function viewSavedShot(p: string) {
    try {
      const r: any = await urlFn({ data: { path: p } });
      window.open(r.url, "_blank");
    } catch (e: any) { toast.error(String(e?.message ?? "Error")); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <PaymentMethodIcon type={selected?.type || "vodafone_cash"} size={56} />
          <div>
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">
              {T("شحن رصيد", "Top up credits")}
            </div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {selected ? (ar ? PAYMENT_TYPE_META[selected.type]?.label.ar : PAYMENT_TYPE_META[selected.type]?.label.en) || selected.label : T("اختر وسيلة الدفع", "Choose a method")}
            </h1>
            <p className="mt-1 text-sm opacity-90">
              {T("اختر وسيلة، حوّل المبلغ، ارفع الإيصال، وسيتم تفعيل الرصيد بعد المراجعة.",
                "Pick a method, transfer, upload the receipt, credits activate after review.")}
            </p>
          </div>
        </div>
      </div>

      {/* Method picker */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{T("وسائل الدفع المتاحة", "Available payment methods")}</h2>
            <span className="text-xs text-muted-foreground">{fallbackMethods.length}</span>
          </div>

          {fallbackMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {T("لم يقم الأدمن بإضافة وسائل دفع بعد.", "Admin hasn't added any payment methods yet.")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {fallbackMethods.map((m: any) => {
                const meta = PAYMENT_TYPE_META[m.type] ?? PAYMENT_TYPE_META.other;
                const isSel = (selected?.id ?? fallbackMethods[0]?.id) === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition hover:bg-muted/50 ${isSel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""}`}
                  >
                    <PaymentMethodIcon type={m.type} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{ar ? meta.label.ar : meta.label.en}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.account_number}</div>
                    </div>
                    {isSel && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="rounded-2xl border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {T("حوّل على", "Transfer to")}
                  </div>
                  <div className="mt-1 break-all text-xl font-bold tracking-wider">{selected.account_number}</div>
                  {selected.account_name && (
                    <div className="mt-1 text-xs">{T("الاسم", "Name")}: <b>{selected.account_name}</b></div>
                  )}
                  {selected.bank_name && (
                    <div className="text-xs">{T("البنك", "Bank")}: <b>{selected.bank_name}</b></div>
                  )}
                  {selected.instructions && (
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{selected.instructions}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(selected.account_number);
                  toast.success(T("تم النسخ", "Copied"));
                }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amount + screenshot */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{T("المبلغ بالجنيه", "Amount (EGP)")}</Label>
              <Input type="number" min={1} value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value || "0"))} />
            </div>
            <div>
              <Label>{T("رقم العملية (اختياري)", "Reference # (optional)")}</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="123456" />
            </div>
          </div>

          <div className="rounded-xl border bg-primary/5 p-3 text-sm">
            <Coins className="me-2 inline h-4 w-4 text-amber-500" />
            {T("ستحصل على", "You will receive")}{" "}
            <b>{expectedCredits}</b>{" "}{T("كريديت", "credits")}
            <span className="text-muted-foreground"> · {rate} {T("لكل جنيه", "per EGP")}</span>
          </div>

          <div>
            <Label>{T("صورة إيصال التحويل", "Transfer screenshot")}</Label>
            <div className="mt-1 grid gap-3 sm:grid-cols-[auto_1fr] items-start">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-xl border bg-muted/30">
                {filePreview ? (
                  <img src={filePreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <Input type="file" accept="image/*"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size/1024).toFixed(0)} KB</p>}
                {!file && <p className="text-xs text-muted-foreground">{T("اختر صورة الإيصال للمعاينة قبل الإرسال", "Pick a receipt image to preview before sending")}</p>}
              </div>
            </div>
          </div>

          <Button onClick={() => mut.mutate()} disabled={uploading || mut.isPending || !selected}
            size="lg" className="w-full gap-2 bg-[image:var(--gradient-primary)]">
            <Upload className="h-4 w-4" />
            {mut.isPending || uploading ? T("جارٍ الإرسال…", "Sending…") : T("إرسال الطلب", "Submit request")}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 font-semibold">{T("طلباتي السابقة", "My previous requests")}</h2>
          <div className="space-y-2">
            {(history ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{T("لا توجد طلبات بعد.", "No requests yet.")}</p>
            )}
            {(history ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{r.amount_egp} EGP → {r.credits_requested} {T("كريديت","cr")}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtCairo(r.created_at)} {r.reference_number && `· #${r.reference_number}`}
                  </div>
                  {r.admin_note && <div className="mt-1 text-xs">{r.admin_note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {r.screenshot_path && (
                    <Button variant="ghost" size="sm" onClick={() => viewSavedShot(r.screenshot_path)} className="gap-1">
                      <Receipt className="h-3 w-3" />{T("الإيصال","Receipt")}
                    </Button>
                  )}
                  <StatusBadge status={r.status} t={T} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (a: string, e: string) => string }) {
  if (status === "approved")
    return <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" />{t("مقبول","Approved")}</span>;
  if (status === "rejected")
    return <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-600"><XCircle className="h-3 w-3" />{t("مرفوض","Rejected")}</span>;
  return <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-600"><Clock className="h-3 w-3" />{t("قيد المراجعة","Pending")}</span>;
}
