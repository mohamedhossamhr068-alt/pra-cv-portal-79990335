import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listMatches, listJobs, runMatch } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, ExternalLink, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: Jobs,
});

function Jobs() {
  const { t } = useTranslation();
  const listFn = useServerFn(listMatches);
  const allJobsFn = useServerFn(listJobs);
  const matchFn = useServerFn(runMatch);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["matches"], queryFn: () => listFn() });
  const { data: allJobs } = useQuery({ queryKey: ["all-jobs"], queryFn: () => allJobsFn() });

  const mut = useMutation({
    mutationFn: () => matchFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Matched");
    },
    onError: (e: any) => {
      if (String(e?.message ?? "").includes("NO_CV")) toast.error("Generate a CV first to get personalized matches.");
      else toast.error(e?.message ?? "Failed");
    },
  });

  // Auto-run matching once if we have no matches yet
  useEffect(() => {
    if (!isLoading && data && data.length === 0 && !mut.isPending) {
      mut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const showMatches = data && data.length > 0;
  const browseList = !showMatches ? allJobs ?? [] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("jobs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("jobs.sub")}</p>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {mut.isPending ? t("jobs.matching") : t("jobs.runMatch")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : showMatches ? (
        <div className="grid gap-3">
          {data!.map((m: any) => (
            <JobRow
              key={m.job_id}
              title={m.job?.title}
              company={m.job?.company}
              location={m.job?.location}
              skills={m.job?.skills ?? []}
              url={m.job?.external_url}
              score={m.score}
            />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Showing all open roles. Generate a CV to get personalized matches with a fit score.
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {browseList.map((j: any) => (
              <JobRow
                key={j.id}
                title={j.title}
                company={j.company}
                location={j.location}
                skills={j.skills ?? []}
                url={j.external_url}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobRow({
  title,
  company,
  location,
  skills,
  url,
  score,
}: {
  title: string;
  company: string;
  location: string;
  skills: string[];
  url?: string;
  score?: number;
}) {
  const { t } = useTranslation();
  return (
    <Card className="transition hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <span className="truncate">{company}</span>
            <span>·</span>
            <MapPin className="h-3 w-3" />
            <span className="truncate">{location}</span>
          </div>
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {skills.slice(0, 5).map((s) => (
                <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        {typeof score === "number" && (
          <div className="text-end">
            <div className="text-2xl font-bold text-primary">{score}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("jobs.match")}</div>
          </div>
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              {t("jobs.apply")}
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}

