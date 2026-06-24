import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getWalletSettings, updateWalletSettings,
  listTenantTopups, reviewTopup, getScreenshotUrl,
  listPaymentMethods, upsertPaymentMethod, deletePaymentMethod,
} from "@/lib/wallet.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Save, CheckCircle2, XCircle, Eye, Clock, Plus, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodIcon, PAYMENT_TYPE_META } from "@/components/payment-method-icon";
import { fmtCairo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/admin/wallet")({
  component: AdminWallet,
});

const TYPES = ["vodafone_cash","orange_cash","etisalat_cash","we_pay","instapay","bank_transfer","fawry","meeza","other"] as const;

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
  const methodsFn = useServerFn(listPaymentMethods);
  const upsertFn = useServerFn(upsertPaymentMethod);
  const delFn = useServerFn(deletePaymentMethod);

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => getFn() });
  const { data: requests } = useQuery({ queryKey: ["tenant-topups"], queryFn: () => listFn() });
  const { data: methods } = useQuery({ queryKey: ["payment-methods"], queryFn: () => methodsFn() });

  const [rate, setRate] = useState(1);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [shotUrls, setShotUrls] = useState<Record<string, string>>({});

  // New method form
  const [nmType, setNmType] = useState<typeof TYPES[number]>("vodafone_cash");
  const [nmLabel, setNmLabel] = useState("");
  const [nmAcct, setNmAcct] = useState("");
  const [nmName, setNmName] = useState("");
  const [nmBank, setNmBank] = useState("");
  const [nmInstr, setNmInstr] = useState("");

  useEffect(() => {
    if (wallet) setRate(Number((wallet as any).credits_per_egp ?? 1));
  }, [wallet]);

  // Resolve signed thumbnail URLs for pending screenshots
  useEffect(() => {
    const pendingShots = (requests ?? []).filter((r: any) => r.status === "pending" && r.screenshot_path && !shotUrls[r.screenshot_path]);
    pendingShots.forEach(async (r: any) => {
      try {
        const res: any = await urlFn({ data: { path: r.screenshot_path } });
        setShotUrls((s) => ({ ...s, [r.screenshot_path]: res.url }));
      } catch {}
    });
  }, [requests]); // eslint-disable-line

  const saveRateMut = useMutation({
    mutationFn: () => updFn({ data: {
      vodafone_number: (wallet as any)?.vodafone_number ?? "",
      instructions: (wallet as any)?.instructions ?? "",
      credits_per_egp: rate,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet"] }); toast.success(T("تم الحفظ","Saved")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  const upsertMut = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-methods"] }); toast.success(T("تم الحفظ","Saved")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-methods"] }); toast.success(T("تم الحذف","Deleted")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  const reviewMut = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) =>
      reviewFn({ data: { request_id: v.id, approve: v.approve, note: noteById[v.id] || "" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-topups"] }); toast.success(T("تم","Done")); },
    onError: (e: any) => toast.error(String(e?.message ?? "Error")),
  });

  function addMethod() {
    if (!nmAcct.trim()) { toast.error(T("أدخل رقم/حساب","Enter account")); return; }
    const meta = PAYMENT_TYPE_META[nmType];
    upsertMut.mutate({
      type: nmType,
      label: nmLabel || (ar ? meta.label.ar : meta.label.en),
      account_number: nmAcct.trim(),
      account_name: nmName || null,
      bank_name: nmBank || null,
      instructions: nmInstr || null,
      is_active: true,
      sort_order: (methods?.length ?? 0),
    });
    setNmLabel(""); setNmAcct(""); setNmName(""); setNmBank(""); setNmInstr("");
  }

  const pending = (requests ?? []).filter((r: any) => r.status === "pending");
  const others = (requests ?? []).filter((r: any) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)]">
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur"><Wallet className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{T("إدارة المحفظة والمدفوعات", "Wallet & Payments")}</h1>
            <p className="mt-1 text-sm opacity-90">
              {T("أضف وسائل دفع متعددة وراجع طلبات شحن المستخدمين.",
                "Add multiple payment methods and review user top-ups.")}
            </p>
          </div>
        </div>
      </div>

      {/* Exchange rate */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-6">
          <div className="flex-1 min-w-[200px]">
            <Label>{T("كريديت لكل جنيه مصري", "Credits per EGP")}</Label>
            <Input type="number" min={0.01} step={0.01} value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value || "0"))} />
          </div>
          <Button onClick={() => saveRateMut.mutate()} disabled={saveRateMut.isPending} className="gap-2">
            <Save className="h-4 w-4" />{saveRateMut.isPending ? T("جارٍ الحفظ…","Saving…") : T("حفظ السعر","Save rate")}
          </Button>
        </CardContent>
      </Card>

      {/* Payment methods */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">{T("وسائل الدفع","Payment methods")}</h2>

          <div className="space-y-2">
            {(methods ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{T("لم تتم إضافة وسائل بعد.", "No methods yet.")}</p>
            )}
            {(methods ?? []).map((m: any) => {
              const meta = PAYMENT_TYPE_META[m.type] ?? PAYMENT_TYPE_META.other;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <PaymentMethodIcon type={m.type} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{m.label || (ar ? meta.label.ar : meta.label.en)}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.account_number} {m.account_name ? `· ${m.account_name}` : ""}{m.bank_name ? ` · ${m.bank_name}` : ""}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1"
                    onClick={() => upsertMut.mutate({ ...m, is_active: !m.is_active })}>
                    <Power className={`h-4 w-4 ${m.is_active ? "text-emerald-600" : "text-muted-foreground"}`} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => delMut.mutate(m.id)}>
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add new method */}
          <div className="rounded-2xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">{T("إضافة وسيلة دفع","Add payment method")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{T("النوع","Type")}</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={nmType} onChange={(e) => setNmType(e.target.value as any)}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{ar ? PAYMENT_TYPE_META[t].label.ar : PAYMENT_TYPE_META[t].label.en}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{T("الاسم الظاهر (اختياري)","Display label (optional)")}</Label>
                <Input value={nmLabel} onChange={(e) => setNmLabel(e.target.value)} placeholder={ar ? PAYMENT_TYPE_META[nmType].label.ar : PAYMENT_TYPE_META[nmType].label.en} />
              </div>
              <div>
                <Label>{T("الرقم / الحساب / IBAN","Account / number / IBAN")}</Label>
                <Input value={nmAcct} onChange={(e) => setNmAcct(e.target.value)} placeholder="010xxxxxxxx" />
              </div>
              <div>
                <Label>{T("اسم صاحب الحساب","Account holder name")}</Label>
                <Input value={nmName} onChange={(e) => setNmName(e.target.value)} />
              </div>
              {(nmType === "bank_transfer" || nmType === "instapay") && (
                <div className="sm:col-span-2">
                  <Label>{T("اسم البنك","Bank name")}</Label>
                  <Input value={nmBank} onChange={(e) => setNmBank(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>{T("تعليمات (اختياري)","Instructions (optional)")}</Label>
                <Textarea rows={2} value={nmInstr} onChange={(e) => setNmInstr(e.target.value)} />
              </div>
            </div>
            <Button onClick={addMethod} disabled={upsertMut.isPending} className="mt-3 gap-2">
              <Plus className="h-4 w-4" />{T("إضافة","Add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending requests with thumbnails */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4" />{T("طلبات قيد المراجعة","Pending requests")} ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">{T("لا توجد طلبات.", "No requests.")}</p>
            )}
            {pending.map((r: any) => {
              const url = shotUrls[r.screenshot_path];
              return (
                <div key={r.id} className="rounded-xl border p-3">
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr] items-start">
                    <button
                      className="group relative h-28 w-full overflow-hidden rounded-lg border bg-muted"
                      onClick={() => url && setViewUrl(url)}
                    >
                      {url ? (
                        <img src={url} alt="receipt" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted-foreground">…</div>
                      )}
                      <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                        <Eye className="h-5 w-5 text-white" />
                      </div>
                    </button>
                    <div className="min-w-0">
                      <div className="font-medium">{r.user?.full_name || r.user?.email || r.user_id.slice(0,8)}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.amount_egp} EGP → {r.credits_requested} {T("كريديت","cr")}
                        {r.reference_number && ` · #${r.reference_number}`} · {fmtCairo(r.created_at)}
                      </div>
                      {r.requested_plan && (
                        <div className="mt-1 text-xs font-medium text-primary">
                          {T("الباقة المطلوبة", "Requested plan")}: {r.requested_plan}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Input placeholder={T("ملاحظة (اختياري)","Note (optional)")} value={noteById[r.id] ?? ""}
                          onChange={(e) => setNoteById((s) => ({ ...s, [r.id]: e.target.value }))} className="flex-1 min-w-[160px]" />
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
                  </div>
                </div>
              );
            })}
          </div>

          {others.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">{T("سجل قديم","History")}</h3>
              <div className="space-y-1 text-xs">
                {others.slice(0, 30).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded border p-2">
                    <span>{r.user?.full_name || r.user?.email || r.user_id.slice(0,8)} — {r.amount_egp} EGP{r.requested_plan ? ` · ${r.requested_plan}` : ""}</span>
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
