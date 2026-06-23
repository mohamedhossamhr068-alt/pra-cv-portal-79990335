import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenantUsers, adminUpdateUser } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff, Ban, Check, Coins, Users, Search, Crown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const listFn = useServerFn(listTenantUsers);
  const updateFn = useServerFn(adminUpdateUser);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-users"], queryFn: () => listFn() });
  const [q, setQ] = useState("");

  const mut = useMutation({
    mutationFn: (vars: any) => updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      toast.success("تم التحديث");
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const users = (data ?? []) as any[];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(t) || (u.full_name ?? "").toLowerCase().includes(t));
  }, [users, q]);

  const totalCredits = users.reduce((s, u) => s + (u.credits ?? 0), 0);
  const admins = users.filter((u) => u.roles?.includes("company_admin")).length;
  const blocked = users.filter((u) => u.is_blocked).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border bg-[image:var(--gradient-primary)] p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest opacity-80">Admin Panel</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">إدارة المستخدمين</h1>
            <p className="mt-1 text-sm opacity-90">تحكّم في الرصيد والصلاحيات والحظر لكل أعضاء شركتك.</p>
          </div>
          <div className="hidden rounded-xl bg-white/15 p-3 backdrop-blur sm:block">
            <Shield className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="المستخدمين" value={users.length} accent="bg-primary/10 text-primary" />
        <StatCard icon={Crown} label="الأدمنز" value={admins} accent="bg-amber-500/15 text-amber-600" />
        <StatCard icon={Coins} label="إجمالي الرصيد" value={totalCredits} accent="bg-emerald-500/15 text-emerald-600" />
        <StatCard icon={Ban} label="محظورين" value={blocked} accent="bg-destructive/15 text-destructive" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الإيميل…" className="ps-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">لا يوجد مستخدمين مطابقين.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} onUpdate={(p) => mut.mutate({ target_user: u.id, ...p })} pending={mut.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, onUpdate, pending }: { user: any; onUpdate: (p: any) => void; pending: boolean }) {
  const [credits, setCredits] = useState<number>(user.credits ?? 0);
  const isAdmin = user.roles?.includes("company_admin");

  return (
    <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]">
          {(user.full_name ?? user.email)?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold">{user.full_name ?? user.email}</div>
            {isAdmin && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>}
            {user.is_blocked && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> محظور</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1">
          <Coins className="h-4 w-4 text-amber-500" />
          <Input
            type="number"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            className="h-8 w-20 border-0 bg-transparent focus-visible:ring-0"
          />
          <Button
            size="sm"
            variant="default"
            disabled={pending || credits === user.credits}
            onClick={() => onUpdate({ credits })}
          >
            حفظ
          </Button>
        </div>

        <Button
          size="sm"
          variant={isAdmin ? "outline" : "secondary"}
          disabled={pending}
          onClick={() => onUpdate({ grant_admin: !isAdmin })}
          className="gap-1.5"
        >
          {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          {isAdmin ? "إزالة Admin" : "ترقية لـ Admin"}
        </Button>

        <Button
          size="sm"
          variant={user.is_blocked ? "default" : "destructive"}
          disabled={pending}
          onClick={() => onUpdate({ is_blocked: !user.is_blocked })}
          className="gap-1.5"
        >
          {user.is_blocked ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
          {user.is_blocked ? "إلغاء الحظر" : "حظر"}
        </Button>
      </CardContent>
    </Card>
  );
}
