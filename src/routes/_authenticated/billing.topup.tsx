import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { createTopupRequest, listMyTopups, getWalletSettings } from "@/lib/wallet.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Upload, Copy, CheckCircle2, Clock, XCircle, Coins } from "lucide-react";
import { toast } from "sonner";
import { useMeQuery } from "@/lib/me.hooks";

export const Route = createFileRoute("/_authenticated/billing/topup")({
  component: TopupPage,
});

function TopupPage() {
  const { i18n: i } = useTranslation();
  const ar = i.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const me = useMeQuery();
  const qc = useQueryClient();
  const walletFn = useServerFn(getWalletSettings);
  const createFn = useServerFn(createTopupRequest);
  const listFn = useServerFn(listMyTopups);

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const { data: history } = useQuery({ queryKey: ["my-topups"], queryFn: () => listFn() });

  const [amount, setAmount] = useState<number>(50);
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const rate = Number((wallet as any)?.credits_per_egp ?? 1);
  const expectedCredits = Math.max(1, Math.floor((amount || 0) * rate));

  const mut = useMutation({
    mutationFn: async () => {
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
      return createFn({ data: { amount_egp: amount, reference_number: ref, screenshot_path: path } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-topups"] });
      toast.success(T("تم إرسال الطلب — سيتم مراجعته قريبًا", "Request sent — pending review"));
      setFile(null); setRef(""); setAmount(50);
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
    onSettled: () => setUploading(false),
  });

  const number = (wallet as any)?.vodafone_number || "";
  const instructions = (wallet as any)?.instructions || "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur"><Smartphone className="h-6 w-6" /></div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">Vodafone Cash</div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{T("شحن الرصيد", "Top up credits")}</h1>
            <p className="mt-1 text-sm opacity-90">
              {T("حوّل المبلغ على رقم المحفظة، ارفع صورة التحويل، وسيتم تفعيل رصيدك بعد المراجعة.",
                "Transfer the amount, upload the screenshot, credits activate after review.")}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
            <div>
              <div className="text-xs text-muted-foreground">{T("رقم محفظة فودافون كاش", "Vodafone Cash number")}</div>
              <div className="mt-1 text-2xl font-bold tracking-wider">{number || "—"}</div>
              {instructions && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{instructions}</p>}
            </div>
            {number && (
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(number);
                toast.success(T("تم النسخ", "Copied"));
              }}><Copy className="h-4 w-4" /></Button>
            )}
          </div>

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
            <Input type="file" accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="mt-1 text-xs text-muted-foreground">{file.name}</p>}
          </div>

          <Button onClick={() => mut.mutate()} disabled={uploading || mut.isPending}
            size="lg" className="w-full gap-2 bg-[image:var(--gradient-primary)]">
            <Upload className="h-4 w-4" />
            {mut.isPending || uploading ? T("جارٍ الإرسال…", "Sending…") : T("إرسال الطلب", "Submit request")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 font-semibold">{T("طلباتي السابقة", "My previous requests")}</h2>
          <div className="space-y-2">
            {(history ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{T("لا توجد طلبات بعد.", "No requests yet.")}</p>
            )}
            {(history ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{r.amount_egp} EGP → {r.credits_requested} {T("كريديت","cr")}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} {r.reference_number && `· #${r.reference_number}`}
                  </div>
                  {r.admin_note && <div className="mt-1 text-xs">{r.admin_note}</div>}
                </div>
                <StatusBadge status={r.status} t={T} />
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
