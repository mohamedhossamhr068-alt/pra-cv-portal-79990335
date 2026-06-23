import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { getCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, ArrowLeft, Mail, Phone, Sparkles, Award, Briefcase, Wrench, Target } from "lucide-react";
import { toast } from "sonner";

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
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const out = data.output as CvOut;
  const tpl = data.template as string;
  const accent = tenant?.primary_color ?? "#4f46e5";

  const handleDownload = async () => {
    const node = pdfRef.current;
    if (!node) {
      toast.error("CV is not ready yet. Please wait a moment and try again.");
      return;
    }
    // Validate the node is actually rendered and has dimensions before attempting capture.
    const rect = node.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50 || !node.isConnected) {
      toast.error("CV content is not visible yet. Scroll to the CV and try again.");
      return;
    }

    setDownloading(true);
    const filename = `${data.title.replace(/[^\w\s-]/g, "").trim() || "cv"}.pdf`;
    const captureOptions = {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: node.scrollWidth,
    } as const;

    const renderCanvas = async () => {
      // html2canvas-pro supports modern CSS color functions (oklch/lab) used by Tailwind v4.
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(node, captureOptions);
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Empty canvas");
      }
      return canvas;
    };

    let canvas: HTMLCanvasElement | null = null;
    // Retry-safe: try up to 3 times, waiting briefly between attempts so late
    // fonts/images/layout settle before the second pass.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        canvas = await renderCanvas();
        break;
      } catch (err) {
        console.warn(`PDF render attempt ${attempt} failed`, err);
        if (attempt === 3) {
          setDownloading(false);
          toast.error("Could not generate PDF. Try the Print option instead.");
          return;
        }
        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
    }

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas!.height * imgW) / canvas!.width;
      const imgData = canvas!.toDataURL("image/jpeg", 0.95);

      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(filename);
    } catch (e) {
      console.error(e);
      toast.error("Could not save the PDF file. Try the Print option instead.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link to="/cv">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            Print
          </Button>
          <Button onClick={handleDownload} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <CardContent className="p-0">
          <div ref={pdfRef} className="bg-white text-neutral-900" style={{ width: "100%" }}>
            <CvTemplate
              output={out}
              template={tpl}
              accent={accent}
              title={data.title}
              tenantName={tenant?.name}
              logoUrl={tenant?.logo_url}
            />
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
    <div className="font-sans text-[12.5px] leading-[1.6] text-neutral-800" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header
        className="px-10 py-8"
        style={{
          background: isCreative
            ? `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`
            : isMinimal
            ? "#ffffff"
            : `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`,
          color: isCreative ? "#ffffff" : "#0f172a",
          borderBottom: isMinimal ? `2px solid ${accent}` : "none",
        }}
      >
        <div className="flex items-start gap-4">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain bg-white/90 p-1" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: isCreative ? "#fff" : "#0f172a" }}>
              {name}
            </h1>
            <div className="mt-1 text-base font-medium" style={{ color: isCreative ? "rgba(255,255,255,0.92)" : accent }}>
              {target}
            </div>
            {tenantName && (
              <div className="mt-2 text-xs uppercase tracking-[0.18em]" style={{ color: isCreative ? "rgba(255,255,255,0.75)" : "#64748b" }}>
                {tenantName}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-10 py-8 space-y-7">
        {/* Summary */}
        <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.summary")} accent={accent}>
          <p className="text-[13px] leading-[1.7] text-neutral-700">{output.summary}</p>
        </Section>

        {/* Competencies */}
        <Section icon={<Target className="h-4 w-4" />} title={t("cv.competencies")} accent={accent}>
          <div className="flex flex-wrap gap-1.5">
            {output.competencies.map((c) => (
              <span
                key={c}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ background: `${accent}15`, color: accent }}
              >
                {c}
              </span>
            ))}
          </div>
        </Section>

        {/* Experience */}
        <Section icon={<Briefcase className="h-4 w-4" />} title={t("cv.professional")} accent={accent}>
          <div className="space-y-5">
            {output.experience.map((e, i) => (
              <div key={i} className="relative ps-4" style={{ borderInlineStart: `2px solid ${accent}30` }}>
                <div
                  className="absolute top-1.5 h-2 w-2 rounded-full"
                  style={{ background: accent, insetInlineStart: "-5px" }}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-neutral-900">
                    {e.role}
                    <span className="font-normal text-neutral-500"> · {e.company}</span>
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{e.dates}</div>
                </div>
                <ul className="ms-4 mt-1.5 list-disc space-y-1 text-neutral-700">
                  {e.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Achievements */}
        {output.achievements.length > 0 && (
          <Section icon={<Award className="h-4 w-4" />} title={t("cv.achievements")} accent={accent}>
            <ul className="ms-4 list-disc space-y-1 text-neutral-700">
              {output.achievements.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Skills matrix */}
        <Section icon={<Wrench className="h-4 w-4" />} title={t("cv.skillsMatrix")} accent={accent}>
          <div className="grid gap-3 sm:grid-cols-2">
            {output.skillsMatrix.map((g) => (
              <div key={g.category} className="rounded-lg p-3" style={{ background: `${accent}08` }}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
                  {g.category}
                </div>
                <div className="text-[12px] text-neutral-700">{g.skills.join(" · ")}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* AI Recommendations */}
        {output.recommendations.length > 0 && (
          <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.recommendations")} accent={accent}>
            <div
              className="rounded-lg border-l-4 p-4"
              style={{ borderColor: accent, background: `${accent}08` }}
            >
              <ul className="ms-4 list-disc space-y-1.5 text-neutral-700">
                {output.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
          {title}
        </h2>
        <div className="ms-2 h-px flex-1" style={{ background: `${accent}25` }} />
      </div>
      {children}
    </section>
  );
}
