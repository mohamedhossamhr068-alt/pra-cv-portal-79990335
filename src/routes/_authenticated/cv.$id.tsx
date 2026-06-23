import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/$id")({
  component: CvViewer,
});

type CvOut = {
  summary: string;
  competencies: string[];
  experience: { role: string; company: string; dates: string; bullets: string[] }[];
  achievements: string[];
  skillsMatrix: { category: string; skills: string[] }[];
  recommendations: string[];
};

function CvViewer() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/_authenticated/cv/$id" });
  const fn = useServerFn(getCv);
  const { data, isLoading } = useQuery({ queryKey: ["cv", id], queryFn: () => fn({ data: { id } }) });
  const me = useMeQuery();
  const tenant = me.data?.tenant;

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const out = data.output as CvOut;
  const tpl = data.template as string;
  const accent = tenant?.primary_color ?? "#4f46e5";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link to="/cv"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />{t("cv.print")}</Button>
      </div>

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <CardContent className={`p-0`}>
          <div
            className={`p-10 ${tpl === "creative_professional" ? "bg-card" : "bg-card"}`}
            style={{ minHeight: 1000 }}
          >
            <CvTemplate output={out} template={tpl} accent={accent} title={data.title} tenantName={tenant?.name} logoUrl={tenant?.logo_url} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CvTemplate({
  output,
  template,
  accent,
  title,
  tenantName,
  logoUrl,
}: {
  output: CvOut;
  template: string;
  accent: string;
  title: string;
  tenantName?: string;
  logoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const [name, target] = title.split(" — ");
  const isCreative = template === "creative_professional";
  const isMinimal = template === "corporate_minimal";

  return (
    <div className="font-sans text-[13px] leading-relaxed text-foreground">
      <header
        className={`mb-6 flex items-center gap-4 ${isCreative ? "rounded-xl p-5 text-white" : "border-b pb-4"}`}
        style={isCreative ? { background: `linear-gradient(135deg, ${accent}, ${accent}cc)` } : {}}
      >
        {logoUrl ? <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain" /> : null}
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-2xl font-bold ${isCreative ? "text-white" : ""}`}>{name}</h1>
          <div className={`text-sm ${isCreative ? "text-white/90" : "text-muted-foreground"}`}>{target}</div>
        </div>
        {tenantName && !isCreative && <div className="text-xs text-muted-foreground">{tenantName}</div>}
      </header>

      <Section title={t("cv.summary")} accent={accent} minimal={isMinimal}>
        <p>{output.summary}</p>
      </Section>

      <Section title={t("cv.competencies")} accent={accent} minimal={isMinimal}>
        <div className="flex flex-wrap gap-2">
          {output.competencies.map((c) => (
            <span key={c} className="rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor: accent + "55", color: accent }}>{c}</span>
          ))}
        </div>
      </Section>

      <Section title={t("cv.professional")} accent={accent} minimal={isMinimal}>
        <div className="space-y-4">
          {output.experience.map((e, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{e.role} · <span className="font-normal text-muted-foreground">{e.company}</span></div>
                <div className="text-xs text-muted-foreground">{e.dates}</div>
              </div>
              <ul className="ms-5 mt-1 list-disc space-y-0.5">
                {e.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("cv.achievements")} accent={accent} minimal={isMinimal}>
        <ul className="ms-5 list-disc space-y-0.5">
          {output.achievements.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </Section>

      <Section title={t("cv.skillsMatrix")} accent={accent} minimal={isMinimal}>
        <div className="grid gap-2 sm:grid-cols-2">
          {output.skillsMatrix.map((g) => (
            <div key={g.category}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</div>
              <div className="text-sm">{g.skills.join(" · ")}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("cv.recommendations")} accent={accent} minimal={isMinimal}>
        <ul className="ms-5 list-disc space-y-0.5">
          {output.recommendations.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, accent, minimal, children }: { title: string; accent: string; minimal: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2
        className={`mb-2 text-xs font-bold uppercase tracking-[0.15em] ${minimal ? "text-foreground" : ""}`}
        style={minimal ? {} : { color: accent }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
