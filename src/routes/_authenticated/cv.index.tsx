import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { listCvs, deleteCv } from "@/lib/cv.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cv/")({
  component: CvLibrary,
});

function CvLibrary() {
  const { t } = useTranslation();
  const fn = useServerFn(listCvs);
  const delFn = useServerFn(deleteCv);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cvs"], queryFn: () => fn() });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cvs"] });
      toast.success("Deleted");
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cv.library")}</h1>
        </div>
        <Link to="/cv/new">
          <Button className="gap-2"><Plus className="h-4 w-4" />{t("cv.new")}</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("cv.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data.map((cv) => (
            <Card key={cv.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{cv.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {cv.template.replace("_", " ")} · {new Date(cv.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Link to="/cv/$id" params={{ id: cv.id }}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => delMut.mutate(cv.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
