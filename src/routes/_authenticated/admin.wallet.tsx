import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getWalletSettings, updateWalletSettings,
  listTenantTopups, reviewTopup, getScreenshotUrl,
} from "@/lib/wallet.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, Save, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/wallet")({
  component: AdminWallet,
});

function AdminWallet() {
  const { i18n: i } = useTranslation();
  const ar = i.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const qc = useQueryClient();
  const getFn = useServerFn(getWalletSettings);
  const updFn = useServerFn(updateWalletSettings);
  const listFn = useServerFn(listTenantTopups);
  const reviewFn = useServerFn(reviewTopup);
  const urlFn = useServerFn(getScreenshotUrl);

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => getFn() });
  const { data: requests } = useQuery({ queryKey: ["tenant-topups"], queryFn: () => listFn() });

  const [number, setNumber] = useState("");
  const [instr, setInstr] = useState("");
  const [rate, setRate] = useState(1);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (wallet) {
      setNumber((wallet as any).vodafone_number ?? "");
      setInstr((wallet as any).instructions ?? "");
      setRate(Number((wallet as any).credits_per_egp ?? 1));
    }
  }, [wallet]);

  const saveMut = useMutation({
    mutationFn: () => updFn({ data: { vodafone_number: number, instructions: instr, credits_per_egp: rate } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet"] }); toast.success(T("تم الحفظ","Saved")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  const reviewMut = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) =>
      reviewFn({ data: { request_id: v.id, approve: v.approve, note: noteById[v.id] || "" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-topups"] }); toast.success(T("تم","Done")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  async function openShot(p: string) {
    try {
      const r: any = await urlFn({ data: { path: p } });
      setViewUrl(r.url);
    } catch (e: any) {
      toast.error(String(e?.message ?? "Error"));
    }
  }

  const pending = (requests ?? []).filter((r: any) => r.status === "pending");
  const others = (requests ?? []).filter((r: any) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)]">
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur"><Smartphone className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{T("محفظة فودافون كاش", "Vodafone Cash Wallet")}</h1>
            <p className="mt-1 text-sm opacity-90">
              {T("اضبط رقم المحفظة وراجع طلبات شحن المستخدمين.", "Configure wallet and review topup requests.")}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">{T("الإعدادات", "Settings")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{T("رقم محفظة فودافون كاش", "Vodafone Cash number")}</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="010xxxxxxxx" />
            </div>
            <div>
              <Label>{T("كريديت لكل جنيه", "Credits per EGP")}</Label>
              <Input type="number" min={0.01} step={0.01} value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value || "0"))} />
            </div>
          </div>
          <div>
            <Label>{T("تعليمات للمستخدم (اختياري)", "Instructions (optional)")}</Label>
            <Textarea rows={3} value={instr} onChange={(e) => setInstr(e.target.value)}
              placeholder={T("مثال: حوّل المبلغ ثم ارفع صورة الإيصال.", "e.g. Send transfer then upload receipt.")} />
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
            <Save className="h-4 w-4" />{saveMut.isPending ? T("جارٍ الحفظ…","Saving…") : T("حفظ","Save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 font-semibold">{T("طلبات قيد المراجعة","Pending requests")} ({pending.length})</h2>
          <div className="space-y-3">
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">{T("لا توجد طلبات.", "No requests.")}</p>
            )}
            {pending.map((r: any) => (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {r.user?.full_name || r.user?.email || r.user_id.slice(0,8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.amount_egp} EGP → {r.credits_requested} {T("كريديت","cr")}
                      {r.reference_number && ` · #${r.reference_number}`} · {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openShot(r.screenshot_path)} className="gap-1">
                    <Eye className="h-3 w-3" />{T("الإيصال","Receipt")}
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  <Input placeholder={T("ملاحظة (اختياري)","Note (optional)")} value={noteById[r.id] ?? ""}
                    onChange={(e) => setNoteById((s) => ({ ...s, [r.id]: e.target.value }))} className="flex-1" />
                  <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => reviewMut.mutate({ id: r.id, approve: true })} disabled={reviewMut.isPending}>
                    <CheckCircle2 className="h-3 w-3" />{T("قبول","Approve")}
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1"
                    onClick={() => reviewMut.mutate({ id: r.id, approve: false })} disabled={reviewMut.isPending}>
                    <XCircle className="h-3 w-3" />{T("رفض","Reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {others.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">{T("سجل قديم","History")}</h3>
              <div className="space-y-1 text-xs">
                {others.slice(0, 30).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded border p-2">
                    <span>
                      {r.user?.full_name || r.user?.email || r.user_id.slice(0,8)} — {r.amount_egp} EGP
                    </span>
                    <span className={`flex items-center gap-1 ${r.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {viewUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setViewUrl(null)}>
          <img src={viewUrl} alt="receipt" className="max-h-[90vh] max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
