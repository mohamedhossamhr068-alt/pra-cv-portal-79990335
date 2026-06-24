import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listMatches, listJobs, runMatch } from "@/lib/jobs.functions";
import { scrapeEgyptJobs } from "@/lib/jobs.scrape.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExternalLink, Sparkles, MapPin, RefreshCw, Building2, Calendar, Coins, Search, X } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["matches"], queryFn: () => listFn() });
  const { data: allJobs, isFetching: isJobsFetching } = useQuery({
    queryKey: ["all-jobs", searchTerm],
    queryFn: () => allJobsFn({ data: { keyword: searchTerm || undefined } }),
  });

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
    mutationFn: (kw?: string) => scrapeFn({ data: { keyword: (kw ?? keyword) || undefined } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["all-jobs"] });
      toast.success(t("jobs.scrapeOk", { n: r?.inserted ?? 0 }));
    },
    onError: (e: any) => toast.error(String(e?.message ?? t("jobs.scrapeFail"))),
  });

  const runSearch = () => {
    const kw = keyword.trim();
    setSearchTerm(kw);
    if (kw.length >= 2) scrape.mutate(kw);
  };

  const clearSearch = () => {
    setKeyword("");
    setSearchTerm("");
  };

  const showMatches = !searchTerm && data && data.length > 0;
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

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("jobs.searchHint")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              className="ps-9 pe-9"
            />
            {keyword && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label={t("common.clear") ?? "Clear"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={runSearch} disabled={scrape.isPending || keyword.trim().length < 2} className="gap-2">
            <Search className="h-4 w-4" />
            {scrape.isPending ? t("jobs.searching") : t("jobs.searchBtn")}
          </Button>
          {isAdmin && (
            <Button onClick={() => scrape.mutate(undefined)} disabled={scrape.isPending} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${scrape.isPending ? "animate-spin" : ""}`} />
              {t("jobs.scrapeBtn")}
            </Button>
          )}
        </CardContent>
      </Card>

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
              {searchTerm
                ? t("jobs.searchResultsFor", { kw: searchTerm, n: browseList.length })
                : t("jobs.allEgyptHint")}
            </CardContent>
          </Card>
          {isJobsFetching && browseList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {browseList.map((j: any) => <JobCard key={j.id} job={j} t={t} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({ job, score, reasoning, t }: { job: any; score?: number; reasoning?: string; t: any }) {
  if (!job) return null;
  const posted = job.posted_at ? new Date(job.posted_at) : null;
  const daysAgo = posted ? Math.floor((Date.now() - posted.getTime()) / 86400000) : null;
  const sourceMeta: Record<string, { label: string; bg: string; domain: string }> = {
    linkedin:  { label: "LinkedIn",   bg: "#0A66C2", domain: "linkedin.com" },
    wuzzuf:    { label: "Wuzzuf",     bg: "#059669", domain: "wuzzuf.net" },
    bayt:      { label: "Bayt",       bg: "#e11d48", domain: "bayt.com" },
    forasna:   { label: "Forasna",    bg: "#ea580c", domain: "forasna.com" },
    indeed:    { label: "Indeed",     bg: "#2557a7", domain: "indeed.com" },
    glassdoor: { label: "Glassdoor",  bg: "#0CAA41", domain: "glassdoor.com" },
    naukrigulf:{ label: "NaukriGulf", bg: "#1e40af", domain: "naukrigulf.com" },
    tanqeeb:   { label: "Tanqeeb",    bg: "#0f766e", domain: "tanqeeb.com" },
  };
  const srcKey = String(job.source ?? "").toLowerCase();
  const src = sourceMeta[srcKey];
  // Multi-source fallback chain: Clearbit (high quality) → DuckDuckGo → Google
  const logoChain = (domain: string) => [
    `https://logo.clearbit.com/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
  const advanceLogo = (e: React.SyntheticEvent<HTMLImageElement>, chain: string[]) => {
    const el = e.currentTarget;
    const idx = Number(el.dataset.idx ?? "0");
    const next = idx + 1;
    if (next < chain.length) {
      el.dataset.idx = String(next);
      el.src = chain[next];
    } else {
      el.style.display = "none";
    }
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
          {(() => {
            let host = "";
            try { host = job.external_url ? new URL(job.external_url).hostname.replace(/^www\./, "") : ""; } catch {}
            const domain = host || src?.domain || "";
            const chain = domain ? logoChain(domain) : [];
            const initial = job.company_logo || chain[0] || "";
            return (
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
                {initial ? (
                  <img
                    src={initial}
                    alt={job.company || ""}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain p-1"
                    data-idx={job.company_logo ? "-1" : "0"}
                    onError={(e) => advanceLogo(e, chain)}
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            );
          })()}

          <div className="min-w-0 flex-1 pe-14">
            <div className="truncate text-sm font-semibold">{job.title}</div>
            <div className="truncate text-xs text-muted-foreground">{job.company}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
          {job.employment_type && <span>· {job.employment_type}</span>}
          {daysAgo !== null && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{daysAgo === 0 ? t("jobs.today") : t("jobs.daysAgo", { n: daysAgo })}</span>
          )}
          {job.source && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: src?.bg ?? "hsl(var(--muted))", color: src ? "#fff" : undefined }}
            >
              {(() => {
                const badgeDomain = src?.domain ?? `${srcKey}.com`;
                const badgeChain = logoChain(badgeDomain);
                return (
                  <img
                    src={badgeChain[0]}
                    alt=""
                    referrerPolicy="no-referrer"
                    data-idx="0"
                    onError={(e) => advanceLogo(e, badgeChain)}
                    className="h-3 w-3 rounded-sm bg-white object-contain p-[1px]"
                  />
                );
              })()}
              {src?.label ?? job.source}
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
              {t("jobs.apply")} <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
