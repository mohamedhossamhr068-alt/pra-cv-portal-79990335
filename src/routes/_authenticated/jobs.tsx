import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listMatches, runMatch } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: Jobs,
});

function Jobs() {
  const { t } = useTranslation();
  const listFn = useServerFn(listMatches);
  const matchFn = useServerFn(runMatch);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["matches"], queryFn: () => listFn() });

  const mut = useMutation({
    mutationFn: () => matchFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Matched");
    },
    onError: (e: any) => {
      if (String(e?.message ?? "").includes("NO_CV")) toast.error(t("jobs.noMatches"));
      else toast.error(e?.message ?? "Failed");
    },
  });

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

      {isLoading ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : !data || data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("jobs.noMatches")}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data.map((m: any) => (
            <Card key={m.job_id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.job?.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.job?.company} · {m.job?.location}</div>
                </div>
                <div className="text-end">
                  <div className="text-2xl font-bold text-primary">{m.score}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("jobs.match")}</div>
                </div>
                {m.job?.external_url && (
                  <a href={m.job.external_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">{t("jobs.apply")}<ExternalLink className="h-3 w-3" /></Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
