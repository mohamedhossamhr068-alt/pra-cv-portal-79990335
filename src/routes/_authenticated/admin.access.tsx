import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listTenantUsers, setUserFeatureFlags } from "@/lib/admin.functions";
import { ALL_FEATURE_FLAGS, type FeatureFlag } from "@/lib/me.hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, Crown } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/access")({
  component: AdminAccess,
});

const LABELS: Record<FeatureFlag, { ar: string; en: string }> = {
  cv_builder: { ar: "إنشاء سيرة ذاتية", en: "CV builder" },
  cv_library: { ar: "مكتبة السير الذاتية", en: "CV library" },
  jobs: { ar: "الوظائف", en: "Jobs" },
  billing: { ar: "الفواتير والخطط", en: "Billing" },
  topup: { ar: "شحن الرصيد", en: "Top up" },
  settings: { ar: "الإعدادات", en: "Settings" },
  chat_support: { ar: "الدعم", en: "Support chat" },
};

function AdminAccess() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const listFn = useServerFn(listTenantUsers);
  const setFn = useServerFn(setUserFeatureFlags);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-users"], queryFn: () => listFn() });
  const [q, setQ] = useState("");

  const users = (data ?? []) as any[];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = users.filter((u) => !(u.roles ?? []).includes("company_admin") && !(u.roles ?? []).includes("superadmin"));
    if (!s) return base;
    return base.filter((u) => (u.email ?? "").toLowerCase().includes(s) || (u.full_name ?? "").toLowerCase().includes(s));
  }, [users, q]);

  const mut = useMutation({
    mutationFn: (vars: { target_user: string; flags: Record<string, boolean> }) => setFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(ar ? "تم الحفظ" : "Saved");
    },
    onError: (e: any) => toast.error(e?.message ?? (ar ? "فشل الحفظ" : "Failed")),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">{ar ? "لوحة الإدارة" : "Admin"}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {ar ? "صلاحيات الواجهة لكل مستخدم" : "Per-user access control"}
            </h1>
            <p className="mt-2 text-sm opacity-90">
              {ar
                ? "تحكّم بالضبط في ما يظهر لكل مستخدم وما يستطيع استخدامه. أوقف خاصية وستختفي من قائمته فورًا."
                : "Decide exactly which features each user can see and use. Turning a feature off hides it from their menu instantly."}
            </p>
          </div>
          <div className="hidden rounded-2xl bg-white/15 p-3 backdrop-blur sm:block">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث عن مستخدم..." : "Search users..."} className="ps-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/30" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{ar ? "لا يوجد مستخدمون" : "No users"}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} ar={ar} onSave={(flags) => mut.mutate({ target_user: u.id, flags })} saving={mut.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, ar, onSave, saving }: { user: any; ar: boolean; onSave: (f: Record<string, boolean>) => void; saving: boolean }) {
  const initial = useMemo<Record<string, boolean>>(() => {
    const f = (user.feature_flags ?? {}) as Record<string, boolean>;
    const out: Record<string, boolean> = {};
    for (const k of ALL_FEATURE_FLAGS) out[k] = f[k] === undefined ? true : !!f[k];
    return out;
  }, [user.feature_flags]);
  const [flags, setFlags] = useState(initial);
  useEffect(() => setFlags(initial), [initial]);
  const dirty = ALL_FEATURE_FLAGS.some((k) => flags[k] !== initial[k]);
  const enabledCount = ALL_FEATURE_FLAGS.filter((k) => flags[k]).length;
  const isMod = (user.roles ?? []).includes("moderator");

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-semibold">{user.full_name || user.email}</div>
              {isMod && <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" />{ar ? "مشرف" : "Moderator"}</Badge>}
              {user.is_blocked && <Badge variant="destructive">{ar ? "محظور" : "Blocked"}</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
          <Badge variant="outline">{enabledCount}/{ALL_FEATURE_FLAGS.length} {ar ? "مفعّلة" : "enabled"}</Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_FEATURE_FLAGS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <span className="text-sm font-medium">{ar ? LABELS[k].ar : LABELS[k].en}</span>
              <Switch checked={!!flags[k]} onCheckedChange={(v) => setFlags((s) => ({ ...s, [k]: v }))} />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFlags(initial)} disabled={!dirty || saving}>
            {ar ? "إلغاء" : "Reset"}
          </Button>
          <Button size="sm" onClick={() => onSave(flags)} disabled={!dirty || saving}>
            {ar ? "حفظ" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
