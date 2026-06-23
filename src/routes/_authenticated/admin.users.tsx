import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenantUsers, adminUpdateUser } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff, Ban, Check, Coins } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const listFn = useServerFn(listTenantUsers);
  const updateFn = useServerFn(adminUpdateUser);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["tenant-users"], queryFn: () => listFn() });

  const mut = useMutation({
    mutationFn: (vars: any) => updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">إدارة المستخدمين</h1>
        <p className="text-sm text-muted-foreground">تحكّم في الرصيد والصلاحيات والحظر لكل أعضاء شركتك.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((u: any) => (
            <UserRow key={u.id} user={u} onUpdate={(p) => mut.mutate({ target_user: u.id, ...p })} pending={mut.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, onUpdate, pending }: { user: any; onUpdate: (p: any) => void; pending: boolean }) {
  const [credits, setCredits] = useState<number>(user.credits ?? 0);
  const isAdmin = user.roles?.includes("company_admin");

  return (
    <Card className="transition hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
          {(user.full_name ?? user.email)?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{user.full_name ?? user.email}</div>
            {isAdmin && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>}
            {user.is_blocked && <Badge variant="destructive">محظور</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-amber-500" />
          <Input
            type="number"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            className="h-8 w-20"
          />
          <Button
            size="sm"
            variant="outline"
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
          {isAdmin ? "إزالة Admin" : "ترقية"}
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
