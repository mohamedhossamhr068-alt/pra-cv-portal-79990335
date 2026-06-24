import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { listCvs, deleteCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, Search, User } from "lucide-react";
import { toast } from "sonner";
import { fmtCairoDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/cv/")({
  component: CvLibrary,
});

function CvLibrary() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const fn = useServerFn(listCvs);
  const delFn = useServerFn(deleteCv);
  const qc = useQueryClient();
  const me = useMeQuery();
  const roles = me.data?.roles ?? [];
  const isAdmin = roles.includes("company_admin") || roles.includes("superadmin");

  const { data, isLoading } = useQuery({ queryKey: ["cvs"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cvs"] });
      toast.success(ar ? "تم الحذف" : "Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const list = (data ?? []) as any[];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (c) =>
        (c.title ?? "").toLowerCase().includes(s) ||
        (c.owner_name ?? "").toLowerCase().includes(s) ||
        (c.owner_email ?? "").toLowerCase().includes(s),
    );
  }, [list, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cv.library")}</h1>
          {isAdmin && (
            <p className="mt-1 text-sm text-muted-foreground">
              {ar ? "كل السير المنشأة في النظام بتوقيت القاهرة." : "All CVs created on the system, Cairo time."}
            </p>
          )}
        </div>
        <Link to="/cv/new">
          <Button className="gap-2"><Plus className="h-4 w-4" />{t("cv.new")}</Button>
        </Link>
      </div>

      {isAdmin && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحث بالعنوان أو المستخدم..." : "Search by title or user..."}
            className="ps-9"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !filtered || filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("cv.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((cv) => (
            <Card key={cv.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{cv.title}</div>
                    {isAdmin && !cv.is_mine && (
                      <Badge variant="secondary" className="gap-1">
                        <User className="h-3 w-3" />
                        {cv.owner_name || cv.owner_email || (ar ? "مستخدم" : "User")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String(cv.template).replace("_", " ")} · {fmtCairoDate(cv.created_at)}
                    {isAdmin && cv.owner_email && !cv.is_mine ? ` · ${cv.owner_email}` : ""}
                  </div>
                </div>
                <Link to="/cv/$id" params={{ id: cv.id }}>
                  <Button variant="outline" size="sm">{ar ? "فتح" : "Open"}</Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(ar ? "حذف هذه السيرة؟" : "Delete this CV?")) delMut.mutate(cv.id);
                  }}
                  aria-label="Delete"
                >
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
