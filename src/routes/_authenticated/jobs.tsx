import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listMatches, listJobs, runMatch } from "@/lib/jobs.functions";
import { scrapeEgyptJobs } from "@/lib/jobs.scrape.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, Sparkles, MapPin, RefreshCw, Building2, Calendar, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: Jobs,
});

function Jobs() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const isAdmin = me.data?.roles?.includes("company_admin") || me.data?.roles?.includes("superadmin");

  const listFn = useServerFn(listMatches);
  const allJobsFn = useServerFn(listJobs);
  const matchFn = useServerFn(runMatch);
  const scrapeFn = useServerFn(scrapeEgyptJobs);
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["matches"], queryFn: () => listFn() });
  const { data: allJobs } = useQuery({ queryKey: ["all-jobs"], queryFn: () => allJobsFn() });

  const mut = useMutation({
    mutationFn: () => matchFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("jobs.matchOk"));
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("NO_CV")) toast.error(t("jobs.needCv"));
      else if (msg.includes("NO_CREDITS")) toast.error(t("jobs.noCredits"));
      else if (msg.includes("BLOCKED")) toast.error(t("jobs.blocked"));
      else toast.error(msg || t("jobs.scrapeFail"));
    },
  });

  const scrape = useMutation({
    mutationFn: () => scrapeFn({ data: { keyword: keyword || undefined } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["all-jobs"] });
      toast.success(t("jobs.scrapeOk", { n: r?.inserted ?? 0 }));
    },
    onError: (e: any) => toast.error(String(e?.message ?? t("jobs.scrapeFail"))),
  });

  useEffect(() => {
    if (!isLoading && data && data.length === 0 && !mut.isPending) {
      // auto-run once
    }
  }, [isLoading, data, mut.isPending]);

  const showMatches = data && data.length > 0;
  const browseList = !showMatches ? allJobs ?? [] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("jobs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("jobs.sub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold">{me.data?.credits ?? 0}</span>
            <span className="text-xs text-muted-foreground">{t("jobs.creditsLabel")}</span>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {mut.isPending ? t("jobs.matching") : t("jobs.runMatch")}
          </Button>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            <Input
              placeholder={t("jobs.scrapeHint")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="min-w-[200px] flex-1"
            />
            <Button onClick={() => scrape.mutate()} disabled={scrape.isPending} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${scrape.isPending ? "animate-spin" : ""}`} />
              {t("jobs.scrapeBtn")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : showMatches ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.map((m: any) => (
            <JobCard key={m.job_id} job={m.job} score={m.score} reasoning={m.reasoning} t={t} />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t("jobs.allEgyptHint")}
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {browseList.map((j: any) => <JobCard key={j.id} job={j} t={t} />)}
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job, score, reasoning }: { job: any; score?: number; reasoning?: string }) {
  if (!job) return null;
  const posted = job.posted_at ? new Date(job.posted_at) : null;
  const daysAgo = posted ? Math.floor((Date.now() - posted.getTime()) / 86400000) : null;
  const sourceColor: Record<string, string> = {
    linkedin: "bg-[#0A66C2] text-white",
    wuzzuf: "bg-emerald-600 text-white",
    bayt: "bg-rose-600 text-white",
    forasna: "bg-orange-600 text-white",
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
      {typeof score === "number" && (
        <div
          className="absolute top-3 end-3 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg"
          style={{
            background: `conic-gradient(${score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"} ${score * 3.6}deg, #e5e7eb 0deg)`,
          }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-card font-bold text-foreground">
            {score}
          </div>
        </div>
      )}
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
            {job.company_logo ? (
              <img
                src={job.company_logo}
                alt={job.company}
                className="h-full w-full object-contain p-1"
                onError={(e) => ((e.currentTarget.style.display = "none"))}
              />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 pe-14">
            <div className="truncate text-sm font-semibold">{job.title}</div>
            <div className="truncate text-xs text-muted-foreground">{job.company}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
          {job.employment_type && <span>· {job.employment_type}</span>}
          {daysAgo !== null && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{daysAgo === 0 ? "اليوم" : `قبل ${daysAgo} يوم`}</span>
          )}
          {job.source && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sourceColor[job.source] ?? "bg-muted text-foreground"}`}>
              {job.source}
            </span>
          )}
        </div>

        {(job.skills ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(job.skills ?? []).slice(0, 5).map((s: string) => (
              <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {s}
              </span>
            ))}
          </div>
        )}

        {reasoning && <p className="text-[11px] text-muted-foreground">{reasoning}</p>}

        {job.external_url && (
          <a href={job.external_url} target="_blank" rel="noreferrer" className="block">
            <Button variant="outline" size="sm" className="w-full gap-2">
              قدّم على المنصة <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
