import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listTenantUsers, adminUpdateUser, setUserPermissions, setModeratorBudget } from "@/lib/admin.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Shield, Ban, Check, Coins, Users, Search, Crown, KeyRound, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ALL_PERMISSIONS = ["manage_users","review_topups","manage_offers","view_audit","view_usage"] as const;
type Permission = typeof ALL_PERMISSIONS[number];


export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { t } = useTranslation();
  const listFn = useServerFn(listTenantUsers);
  const updateFn = useServerFn(adminUpdateUser);
  const qc = useQueryClient();
  const me = useMeQuery();
  const meId = (me.data?.profile as any)?.id as string | undefined;
  const { data, isLoading } = useQuery({ queryKey: ["tenant-users"], queryFn: () => listFn() });
  const [q, setQ] = useState("");

  const mut = useMutation({
    mutationFn: (vars: any) => updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      toast.success(t("admin.updated"));
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("MOD_BUDGET_EXCEEDED")) {
        toast.error(t("admin.budgetExhausted"));
      } else if (msg.includes("MOD_CANNOT_LOWER_CREDITS")) {
        toast.error(t("admin.budgetCannotLower"));
      } else if (msg.includes("SELF_DEMOTE_FORBIDDEN")) {
        toast.error(t("admin.selfDemoteForbidden"));
      } else if (msg.includes("LAST_ADMIN_FORBIDDEN")) {
        toast.error(t("admin.lastAdminForbidden"));
      } else {
        toast.error(e?.message ?? t("admin.updateFailed"));
      }
    },
  });

  const users = (data ?? []) as any[];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(s) || (u.full_name ?? "").toLowerCase().includes(s));
  }, [users, q]);

  const totalCredits = users.reduce((s, u) => s + (u.credits ?? 0), 0);
  const admins = users.filter((u) => u.roles?.includes("company_admin")).length;
  const blocked = users.filter((u) => u.is_blocked).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-luxe)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] opacity-80">{t("admin.panel")}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.usersTitle")}</h1>
            <p className="mt-2 text-sm opacity-90">{t("admin.usersSub")}</p>
          </div>
          <div className="hidden rounded-2xl bg-white/15 p-3 backdrop-blur sm:block">
            <Shield className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label={t("admin.statUsers")} value={users.length} accent="bg-primary/10 text-primary" />
        <StatCard icon={Crown} label={t("admin.statAdmins")} value={admins} accent="bg-amber-500/15 text-amber-600" />
        <StatCard icon={Coins} label={t("admin.statCredits")} value={totalCredits} accent="bg-emerald-500/15 text-emerald-600" />
        <StatCard icon={Ban} label={t("admin.statBlocked")} value={blocked} accent="bg-destructive/15 text-destructive" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchUsers")} className="ps-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("admin.noUsers")}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} meId={meId} onUpdate={(p) => mut.mutate({ target_user: u.id, ...p })} pending={mut.isPending} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${accent} transition-transform group-hover:scale-110`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, meId, onUpdate, pending, t }: { user: any; meId?: string; onUpdate: (p: any) => void; pending: boolean; t: any }) {
  const [credits, setCredits] = useState<number>(user.credits ?? 0);
  const [permOpen, setPermOpen] = useState(false);
  const isAdmin = user.roles?.includes("company_admin");
  const isModerator = user.roles?.includes("moderator");
  const permCount = (user.permissions ?? []).length;
  const isSelf = !!meId && meId === user.id;

  return (
    <Card className="overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)]">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]">
          {(user.full_name ?? user.email)?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold">{user.full_name ?? user.email}</div>
            {isAdmin && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> {t("admin.adminBadge")}</Badge>}
            {isModerator && !isAdmin && (
              <Badge variant="outline" className="gap-1">
                <KeyRound className="h-3 w-3" /> {t("admin.moderatorBadge")} · {permCount}
              </Badge>
            )}
            {isModerator && !isAdmin && (
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                <Wallet className="h-3 w-3" />
                {user.grant_budget == null
                  ? t("admin.budgetUnlimited")
                  : `${(user.grant_budget ?? 0) - (user.grant_used ?? 0)} / ${user.grant_budget} · ${t(`admin.budgetPeriod_${user.grant_period ?? "monthly"}`)}`}
              </Badge>
            )}
            {user.is_blocked && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> {t("admin.blockedBadge")}</Badge>}
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
            {t("admin.save")}
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setPermOpen(true)}
          className="gap-1.5"
        >
          <KeyRound className="h-3.5 w-3.5" /> {t("admin.manageRole")}
        </Button>

        <Button
          size="sm"
          variant={user.is_blocked ? "default" : "destructive"}
          disabled={pending}
          onClick={() => onUpdate({ is_blocked: !user.is_blocked })}
          className="gap-1.5"
        >
          {user.is_blocked ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
          {user.is_blocked ? t("admin.unblock") : t("admin.block")}
        </Button>

        <RoleDialog
          open={permOpen}
          onOpenChange={setPermOpen}
          user={user}
          isSelf={isSelf}
          t={t}
        />
      </CardContent>
    </Card>
  );
}

type RoleKind = "user" | "moderator" | "admin";

function RoleDialog({ open, onOpenChange, user, t }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: any;
  t: any;
}) {
  const qc = useQueryClient();
  const setPerms = useServerFn(setUserPermissions);
  const updateUser = useServerFn(adminUpdateUser);
  const setBudget = useServerFn(setModeratorBudget);
  const initialPerms = (user.permissions ?? []) as Permission[];
  const wasAdmin = user.roles?.includes("company_admin");
  const wasModerator = user.roles?.includes("moderator");
  const initialRole: RoleKind = wasAdmin ? "admin" : wasModerator ? "moderator" : "user";

  const [role, setRole] = useState<RoleKind>(initialRole);
  const [selected, setSelected] = useState<Set<Permission>>(new Set(initialPerms));
  const [unlimited, setUnlimited] = useState<boolean>(user.grant_budget == null);
  const [budget, setBudgetVal] = useState<number>(user.grant_budget ?? 0);
  const [period, setPeriod] = useState<"monthly" | "total">((user.grant_period as any) ?? "monthly");
  const [resetUsed, setResetUsed] = useState<boolean>(false);

  const toggle = (p: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (role === "admin" && !wasAdmin) {
        await updateUser({ data: { target_user: user.id, grant_admin: true } });
      } else if (role !== "admin" && wasAdmin) {
        await updateUser({ data: { target_user: user.id, grant_admin: false } });
      }
      const perms: Permission[] = role === "moderator" ? Array.from(selected) : [];
      const makeMod = role === "moderator" ? true : role === "user" ? false : null;
      await setPerms({
        data: {
          target_user: user.id,
          permissions: perms,
          ...(makeMod !== null ? { make_moderator: makeMod } : {}),
        },
      });
      if (role === "moderator") {
        await setBudget({
          data: {
            target_user: user.id,
            budget: unlimited ? null : Math.max(0, Math.floor(budget)),
            reset_used: resetUsed,
            period,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      toast.success(t("admin.roleSaved"));
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? t("admin.updateFailed")),
  });

  const roleOptions: { id: RoleKind; icon: any }[] = [
    { id: "user", icon: Users },
    { id: "moderator", icon: KeyRound },
    { id: "admin", icon: Shield },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t("admin.permissionsFor", { name: user.full_name ?? user.email })}
          </DialogTitle>
          <DialogDescription>{t("admin.permissionsHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("admin.roleLabel")}
          </div>
          {roleOptions.map(({ id, icon: Icon }) => {
            const active = role === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setRole(id)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-start transition-colors ${
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t(`admin.role${id.charAt(0).toUpperCase() + id.slice(1)}`)}</div>
                  <div className="text-xs text-muted-foreground">{t(`admin.role${id.charAt(0).toUpperCase() + id.slice(1)}_desc`)}</div>
                </div>
              </button>
            );
          })}
        </div>

        {role === "moderator" && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("admin.permissions")}
            </div>
            {ALL_PERMISSIONS.map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <Checkbox checked={selected.has(p)} onCheckedChange={() => toggle(p)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t(`admin.perm_${p}`)}</div>
                  <div className="text-xs text-muted-foreground">{t(`admin.perm_${p}_desc`)}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {role === "moderator" && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> {t("admin.budgetTitle")}
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.budgetHint")}</p>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={unlimited} onCheckedChange={(v) => setUnlimited(!!v)} />
              <span className="text-sm">{t("admin.budgetUnlimited")}</span>
            </label>
            {!unlimited && (
              <div className="space-y-2">
                <Label className="text-xs">{t("admin.budgetAmount")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudgetVal(Number(e.target.value))}
                />
                <div>
                  <Label className="text-xs">{t("admin.budgetPeriod")}</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(["monthly", "total"] as const).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          period === p ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                        }`}
                      >
                        {t(`admin.budgetPeriod_${p}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded border bg-background px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">{t("admin.budgetUsed")}</span>
                  <span className="font-medium">
                    {user.grant_used ?? 0} / {budget || 0}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={resetUsed} onCheckedChange={(v) => setResetUsed(!!v)} />
                  <span className="text-xs">{t("admin.budgetReset")}</span>
                </label>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? t("admin.saving") : t("admin.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


