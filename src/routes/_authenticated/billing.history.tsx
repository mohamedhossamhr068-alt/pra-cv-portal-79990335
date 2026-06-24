import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listMyTopups, getScreenshotUrl } from "@/lib/wallet.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, XCircle, Receipt, Coins, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodIcon, PAYMENT_TYPE_META } from "@/components/payment-method-icon";
import { fmtCairo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/billing/history")({
  component: HistoryPage,
});

type Row = any;

function HistoryPage() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const listFn = useServerFn(listMyTopups);
  const urlFn = useServerFn(getScreenshotUrl);

  const { data, isLoading } = useQuery({ queryKey: ["my-topups"], queryFn: () => listFn() });

  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");

  const rows: Row[] = useMemo(() => {
    let xs = (data as Row[] | undefined) ?? [];
    if (filter !== "all") xs = xs.filter((r) => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      xs = xs.filter((r) =>
        String(r.reference_number ?? "").toLowerCase().includes(q) ||
        String(r.amount_egp ?? "").includes(q) ||
        String(r.payment_method?.label ?? "").toLowerCase().includes(q),
      );
    }
    return xs;
  }, [data, filter, search]);

  const totals = useMemo(() => {
    const xs = (data as Row[] | undefined) ?? [];
    return {
      pending: xs.filter((r) => r.status === "pending").length,
      approved: xs.filter((r) => r.status === "approved").length,
      rejected: xs.filter((r) => r.status === "rejected").length,
      credits: xs.filter((r) => r.status === "approved").reduce((s, r) => s + (r.credits_granted ?? 0), 0),
    };
  }, [data]);

  async function viewShot(p: string) {
    try {
      const r: any = await urlFn({ data: { path: p } });
      window.open(r.url, "_blank");
    } catch (e: any) { toast.error(String(e?.message ?? "Error")); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">
              {T("سجل الشحنات", "Top-up history")}
            </div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {T("كل طلبات الشحن الخاصة بك", "All your top-up requests")}
            </h1>
            <p className="mt-1 text-sm opacity-90">
              {T("تابع حالة كل طلب ومراجعته والاطلاع على الإيصال.", "Track status, review notes, and view receipts.")}
            </p>
          </div>
          <Link to="/billing/topup">
            <Button size="lg" className="gap-2 bg-white/15 hover:bg-white/25 backdrop-blur">
              <Plus className="h-4 w-4" /> {T("طلب شحن جديد", "New top-up")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label={T("قيد المراجعة", "Pending")} value={totals.pending} tone="amber" icon={<Clock className="h-4 w-4" />} />
        <StatCard label={T("مقبول", "Approved")} value={totals.approved} tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label={T("مرفوض", "Rejected")} value={totals.rejected} tone="rose" icon={<XCircle className="h-4 w-4" />} />
        <StatCard label={T("إجمالي الكريديت", "Total credits")} value={totals.credits} tone="primary" icon={<Coins className="h-4 w-4" />} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
                {s === "all" ? T("الكل", "All")
                  : s === "pending" ? T("قيد المراجعة", "Pending")
                  : s === "approved" ? T("مقبول", "Approved")
                  : T("مرفوض", "Rejected")}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="ps-8" placeholder={T("ابحث بالمبلغ، رقم العملية، أو الوسيلة", "Search amount, ref, or method")}
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{T("جارٍ التحميل…", "Loading…")}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">{T("لا توجد طلبات تطابق التصفية", "No requests match this filter")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {T("ابدأ بطلب شحن جديد لإضافة رصيد لحسابك.", "Start a new top-up to add credits to your account.")}
              </p>
              <Link to="/billing/topup">
                <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> {T("شحن رصيد", "Top up")}</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const type = r.payment_method?.type ?? "other";
                const meta = PAYMENT_TYPE_META[type] ?? PAYMENT_TYPE_META.other;
                const methodLabel = r.payment_method?.label || (ar ? meta.label.ar : meta.label.en);
                return (
                  <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <PaymentMethodIcon type={type} size={44} />
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {r.amount_egp} {T("ج.م", "EGP")}
                          <span className="mx-2 text-muted-foreground">→</span>
                          <span className="text-primary">
                            {r.status === "approved" ? (r.credits_granted ?? r.credits_requested) : r.credits_requested} {T("كريديت", "credits")}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {methodLabel}
                          {r.payment_method?.account_number && <> · {r.payment_method.account_number}</>}
                          {r.reference_number && <> · #{r.reference_number}</>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {T("أُرسل", "Sent")}: {fmtCairo(r.created_at)}
                          {r.reviewed_at && <> · {T("روجع", "Reviewed")}: {fmtCairo(r.reviewed_at)}</>}
                        </div>
                        {r.admin_note && (
                          <div className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-xs">
                            <span className="font-medium">{T("ملاحظة الأدمن", "Admin note")}:</span> {r.admin_note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      <StatusBadge status={r.status} t={T} />
                      {r.screenshot_path && (
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => viewShot(r.screenshot_path)}>
                          <Receipt className="h-3.5 w-3.5" /> {T("الإيصال", "Receipt")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: "amber" | "emerald" | "rose" | "primary"; icon: React.ReactNode }) {
  const toneCls =
    tone === "amber" ? "bg-amber-500/10 text-amber-600"
    : tone === "emerald" ? "bg-emerald-500/10 text-emerald-600"
    : tone === "rose" ? "bg-rose-500/10 text-rose-600"
    : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneCls}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, t }: { status: string; t: (a: string, e: string) => string }) {
  if (status === "approved")
    return <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" />{t("مقبول", "Approved")}</span>;
  if (status === "rejected")
    return <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-600"><XCircle className="h-3 w-3" />{t("مرفوض", "Rejected")}</span>;
  return <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-600"><Clock className="h-3 w-3" />{t("قيد المراجعة", "Pending")}</span>;
}
