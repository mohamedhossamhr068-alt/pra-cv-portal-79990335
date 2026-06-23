import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeam, inviteTeammate } from "@/lib/tenant.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/team")({
  component: Team,
});

function Team() {
  const { t } = useTranslation();
  const listFn = useServerFn(listTeam);
  const inviteFn = useServerFn(inviteTeammate);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["team"], queryFn: () => listFn() });
  const [email, setEmail] = useState("");

  const mut = useMutation({
    mutationFn: () => inviteFn({ data: { email } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setEmail("");
      toast.success("Invite sent");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.teamTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.teamSub")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("admin.invite")}</CardTitle></CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email) mut.mutate();
            }}
          >
            <div className="min-w-0 flex-1">
              <Label>{t("admin.inviteEmail")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
            </div>
            <Button type="submit" disabled={mut.isPending}>{t("admin.inviteSend")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <ul className="divide-y">
              {(data ?? []).map((m: any) => (
                <li key={m.id} className="flex items-center gap-3 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.full_name ?? m.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
