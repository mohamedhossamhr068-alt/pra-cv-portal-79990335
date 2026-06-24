import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listAuditLogs } from "@/lib/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Info, ExternalLink, RefreshCw, Search } from "lucide-react";

type Category = "all" | "cv" | "stripe" | "ai" | "topup" | "admin";
type Status = "all" | "success" | "failure" | "info";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { t } = useTranslation();
  const fn = useServerFn(listAuditLogs);
  const [category, setCategory] = useState<Category>("all");
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", category, status, committedSearch],
    queryFn: () => fn({ data: { category, status, search: committedSearch, limit: 200 } }),
  });

  const logs = data ?? [];

  const counts = {
    total: logs.length,
    success: logs.filter((l: any) => l.status === "success").length,
    failure: logs.filter((l: any) => l.status === "failure").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.auditTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.auditSub")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> {t("admin.refresh")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("admin.auditTotal")} value={counts.total} />
        <StatCard label={t("admin.auditSuccess")} value={counts.success} tone="success" />
        <StatCard label={t("admin.auditFailure")} value={counts.failure} tone="danger" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("admin.auditFilters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.catAll")}</SelectItem>
              <SelectItem value="cv">{t("admin.catCv")}</SelectItem>
              <SelectItem value="stripe">{t("admin.catStripe")}</SelectItem>
              <SelectItem value="ai">{t("admin.catAi")}</SelectItem>
              <SelectItem value="topup">{t("admin.catTopup")}</SelectItem>
              <SelectItem value="admin">{t("admin.catAdmin")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.statusAll")}</SelectItem>
              <SelectItem value="success">{t("admin.statusSuccess")}</SelectItem>
              <SelectItem value="failure">{t("admin.statusFailure")}</SelectItem>
              <SelectItem value="info">{t("admin.statusInfo")}</SelectItem>
            </SelectContent>
          </Select>
          <form
            className="sm:col-span-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCommittedSearch(search);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.auditSearch")}
                className="ps-8"
              />
            </div>
            <Button type="submit" variant="secondary">{t("admin.search")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{t("admin.auditEmpty")}</div>
          ) : (
            <ul className="divide-y">
              {logs.map((log: any) => (
                <LogRow key={log.id} log={log} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function LogRow({ log }: { log: any }) {
  const { t, i18n } = useTranslation();
  const date = new Date(log.created_at).toLocaleString(i18n.language === "ar" ? "ar-EG" : undefined);
  const StatusIcon = log.status === "success" ? CheckCircle2 : log.status === "failure" ? XCircle : Info;
  const statusColor =
    log.status === "success"
      ? "text-emerald-600"
      : log.status === "failure"
      ? "text-destructive"
      : "text-muted-foreground";

  const actorName = log.actor?.full_name || log.actor?.email || t("admin.system");
  const errorMsg = log.metadata?.error as string | undefined;

  return (
    <li className="flex flex-wrap items-start gap-3 p-4">
      <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.action}</code>
          <Badge variant={log.status === "failure" ? "destructive" : "secondary"} className="text-[10px]">
            {t(`admin.status${log.status.charAt(0).toUpperCase() + log.status.slice(1)}` as any)}
          </Badge>
          {log.target && (
            <span className="text-xs text-muted-foreground truncate">{log.target}</span>
          )}
        </div>
        {errorMsg && (
          <div className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive break-words">
            {errorMsg}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{actorName}</span>
          <span>•</span>
          <span>{date}</span>
          {log.link && (
            <Link to={log.link} className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> {t("admin.openRecord")}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
