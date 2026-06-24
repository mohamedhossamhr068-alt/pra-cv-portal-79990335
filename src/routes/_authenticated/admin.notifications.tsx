import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listAdminNotifications, markNotificationsRead } from "@/lib/admin-notifications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellRing, CheckCheck, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { fmtCairo } from "@/lib/time";

type TypeFilter = "all" | "admin_action" | "topup_approved" | "topup_rejected" | "offer_created" | "cv_generated";
type ReadFilter = "all" | "unread" | "read";
type Since = "all" | "24h" | "7d" | "30d";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminNotifications);
  const markFn = useServerFn(markNotificationsRead);

  const [type, setType] = useState<TypeFilter>("admin_action");
  const [read, setRead] = useState<ReadFilter>("all");
  const [since, setSince] = useState<Since>("all");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-notifications", type, read, since],
    queryFn: () => listFn({ data: { type, read, since, limit: 200 } }),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const markOne = useMutation({
    mutationFn: (id: string) => markFn({ data: { ids: [id] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => markFn({ data: { all: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast.success(t("adminNotif.allMarkedRead"));
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <BellRing className="h-6 w-6 text-primary" /> {t("adminNotif.title")}
            {unread > 0 && (
              <Badge variant="destructive" className="ms-1">{unread}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{t("adminNotif.sub")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> {t("admin.refresh")}
          </Button>
          <Button size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending || unread === 0} className="gap-2">
            <CheckCheck className="h-4 w-4" /> {t("adminNotif.markAll")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("admin.auditFilters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminNotif.typeAll")}</SelectItem>
              <SelectItem value="admin_action">{t("adminNotif.typeAdminAction")}</SelectItem>
              <SelectItem value="topup_approved">{t("adminNotif.typeTopupApproved")}</SelectItem>
              <SelectItem value="topup_rejected">{t("adminNotif.typeTopupRejected")}</SelectItem>
              <SelectItem value="offer_created">{t("adminNotif.typeOfferCreated")}</SelectItem>
              <SelectItem value="cv_generated">{t("adminNotif.typeCvGenerated")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={read} onValueChange={(v) => setRead(v as ReadFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminNotif.readAll")}</SelectItem>
              <SelectItem value="unread">{t("adminNotif.unread")}</SelectItem>
              <SelectItem value="read">{t("adminNotif.read")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={since} onValueChange={(v) => setSince(v as Since)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminNotif.timeAll")}</SelectItem>
              <SelectItem value="24h">{t("adminNotif.time24h")}</SelectItem>
              <SelectItem value="7d">{t("adminNotif.time7d")}</SelectItem>
              <SelectItem value="30d">{t("adminNotif.time30d")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              {t("adminNotif.empty")}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n: any) => (
                <NotifRow
                  key={n.id}
                  n={n}
                  onMark={() => markOne.mutate(n.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotifRow({ n, onMark }: { n: any; onMark: () => void }) {
  const { t, i18n } = useTranslation();
  const isUnread = !n.read_at;
  const date = fmtCairo(n.created_at, i18n.language);
  const actorName = n.actor?.full_name || n.actor?.email;
  const status = n.metadata?.status as string | undefined;

  return (
    <li className={`flex flex-wrap items-start gap-3 p-4 transition ${isUnread ? "bg-primary/5" : ""}`}>
      <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${isUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <ShieldAlert className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
          {isUnread && <Badge variant="destructive" className="text-[10px]">{t("adminNotif.new")}</Badge>}
          {status && (
            <Badge variant={status === "failure" ? "destructive" : "secondary"} className="text-[10px]">
              {status}
            </Badge>
          )}
        </div>
        {n.body && <div className="break-words text-xs text-muted-foreground">{n.body}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {actorName && <><span>{actorName}</span><span>•</span></>}
          <span>{date}</span>
          {n.link && (
            <a href={n.link} className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> {t("admin.openRecord")}
            </a>
          )}
        </div>
      </div>
      {isUnread && (
        <Button variant="ghost" size="sm" onClick={onMark} className="shrink-0 gap-1.5">
          <CheckCheck className="h-3.5 w-3.5" /> {t("adminNotif.markRead")}
        </Button>
      )}
    </li>
  );
}
