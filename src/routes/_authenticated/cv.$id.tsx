import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCv, updateCvStyle, translateCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, ArrowLeft, Sparkles, Award, Briefcase, Wrench, Target, MessageCircle, TrendingUp, Globe2, Mail, Phone, MapPin, FileText, Gauge, Palette, Check, Languages } from "lucide-react";
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

type CvAnalysis = {
  strengths: string[];
  weaknesses: string[];
  interviewQuestions: { question: string; hint: string }[];
  improvementPlan: string[];
  platforms: { name: string; url: string; fitScore: number; reason: string }[];
};

// Compute a realistic ATS compatibility score with PARTIAL credit per check.
// Score varies based on actual data quality, not binary pass/fail.
function computeAtsScore(
  out: CvOut,
  input: any,
): {
  score: number;
  checks: { label: string; pass: boolean; partial: boolean; weight: number; tip?: string; detail?: string }[];
} {
  const ar = input?.locale === "ar";
  type Item = { label: string; score: number; max: number; tip?: string; detail?: string };
  const items: Item[] = [];

  // 1. Summary length quality (0-12)
  const sLen = (out.summary || "").trim().length;
  const summaryScore = sLen >= 120 && sLen <= 320 ? 12 : sLen >= 80 ? 8 : sLen >= 40 ? 4 : 0;
  items.push({
    label: ar ? "ملخص مهني (120-320 حرف)" : "Professional summary (120-320 chars)",
    score: summaryScore, max: 12,
    tip: summaryScore < 12 ? (ar ? "اكتب ملخص بين 120 و320 حرف يلخص دورك وتأثيرك." : "Write a 120-320 char summary covering role + impact.") : undefined,
    detail: `${sLen} ${ar ? "حرف" : "chars"}`,
  });

  // 2. Core competencies count (0-8)
  const cc = out.competencies?.length ?? 0;
  items.push({
    label: ar ? "كفاءات رئيسية (8+)" : "Core competencies (8+)",
    score: Math.min(8, cc), max: 8, detail: `${cc}`,
  });

  // 3. Experience entries (0-10)
  const expCount = out.experience?.length ?? 0;
  items.push({
    label: ar ? "عدد الخبرات" : "Experience entries",
    score: expCount >= 3 ? 10 : expCount === 2 ? 7 : expCount === 1 ? 4 : 0, max: 10,
    tip: expCount < 2 ? (ar ? "أضف خبرة سابقة واحدة على الأقل لتعزيز السيرة." : "Add at least one past role.") : undefined,
    detail: `${expCount}`,
  });

  // 4. Bullet depth (avg per role) (0-10)
  const allBullets = (out.experience ?? []).flatMap((e) => e.bullets ?? []);
  const avgBullets = expCount ? allBullets.length / expCount : 0;
  items.push({
    label: ar ? "تفاصيل المهام (نقاط لكل خبرة)" : "Bullet depth per role",
    score: avgBullets >= 4 ? 10 : avgBullets >= 3 ? 7 : avgBullets >= 2 ? 4 : 0, max: 10,
    detail: `${avgBullets.toFixed(1)}/role`,
  });

  // 5. Quantified achievements (metric density) (0-16) — heavy weight
  const totalBul = allBullets.length || 1;
  const metricBul = allBullets.filter((b) => /\d/.test(b)).length;
  const ratio = metricBul / totalBul;
  items.push({
    label: ar ? "أرقام قابلة للقياس داخل النقاط" : "Quantified bullets (% with numbers)",
    score: Math.round(ratio * 16), max: 16,
    tip: ratio < 0.5 ? (ar ? "أدخل أرقام في معظم النقاط (نسب، عملة، حجم فريق…)." : "Add metrics to most bullets (%, $, team size…).") : undefined,
    detail: `${Math.round(ratio * 100)}%`,
  });

  // 6. Action verbs (0-6)
  const verbs = ["led","managed","built","designed","launched","increased","reduced","improved","developed","created","optimized","delivered","drove","spearheaded","قاد","أدار","طوّر","صمّم","نفّذ","حسّن","زاد","قلّل","أطلق"];
  const verbHits = allBullets.filter((b) => verbs.some((v) => b.toLowerCase().includes(v))).length;
  items.push({
    label: ar ? "أفعال إجرائية قوية" : "Strong action verbs",
    score: Math.min(6, verbHits), max: 6,
    tip: verbHits < 4 ? (ar ? "ابدأ كل نقطة بفعل قوي (قاد، طوّر، أطلق…)." : "Start bullets with strong verbs (Led, Built, Launched…).") : undefined,
  });

  // 7. Third-person voice (penalty for "I/my/we") (0-4)
  const firstPersonRe = /\b(I|my|me|we|our)\b/;
  const fpHits = allBullets.filter((b) => firstPersonRe.test(b)).length;
  items.push({
    label: ar ? "صياغة احترافية (بدون ضمير المتكلم)" : "Third-person voice",
    score: Math.max(0, 4 - fpHits), max: 4,
    tip: fpHits > 0 ? (ar ? `احذف ضمير المتكلم من ${fpHits} نقطة.` : `Remove first-person voice from ${fpHits} bullet(s).`) : undefined,
  });

  // 8. Achievements section (0-6)
  const ach = out.achievements?.length ?? 0;
  items.push({
    label: ar ? "إنجازات بارزة" : "Highlighted achievements",
    score: ach >= 3 ? 6 : ach === 2 ? 4 : ach === 1 ? 2 : 0, max: 6, detail: `${ach}`,
  });

  // 9. Skills matrix richness (0-6)
  const skillsCount = (out.skillsMatrix ?? []).reduce((s, g) => s + (g.skills?.length ?? 0), 0);
  items.push({
    label: ar ? "ثراء المهارات المصنّفة" : "Skills matrix richness",
    score: Math.min(6, Math.round(skillsCount / 3)), max: 6, detail: `${skillsCount} skills`,
  });

  // 10. Contact info quality (0-8)
  let contact = 0;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input?.email || "");
  const phoneOk = (input?.phone || "").replace(/\D/g, "").length >= 7;
  if (emailOk) contact += 4; else if ((input?.email || "").length) contact += 1;
  if (phoneOk) contact += 2;
  if ((input?.location || "").length > 0) contact += 2;
  items.push({
    label: ar ? "بيانات التواصل" : "Contact info",
    score: contact, max: 8,
    tip: contact < 8 ? (ar ? "أكمل الإيميل (صيغة صحيحة) والهاتف والموقع." : "Add a valid email, phone, and location.") : undefined,
  });

  // 11. English proficiency (low weight — optional) (0-2)
  const levels: Record<string, number> = { none: 0, basic: 1, intermediate: 2, advanced: 2, fluent: 2, native: 2 };
  const elv = levels[(input?.englishLevel ?? "").toLowerCase()] ?? 1;
  items.push({
    label: ar ? "مستوى اللغة الإنجليزية" : "English proficiency",
    score: elv, max: 2,
    detail: input?.englishLevel || "-",
  });

  // 12. Additional languages (optional) (0-1)
  const langCount = Array.isArray(input?.languages) ? input.languages.length : 0;
  items.push({
    label: ar ? "لغات إضافية" : "Additional languages",
    score: Math.min(1, langCount), max: 1, detail: `${langCount}`,
  });

  // 13. ERP / systems exposure (optional) (0-1)
  const hasErp = typeof input?.erp === "string" && input.erp.trim().length > 1;
  items.push({
    label: ar ? "أنظمة ERP / برامج تخصصية" : "ERP / specialised systems",
    score: hasErp ? 1 : 0, max: 1,
  });

  // 14. Education/Certifications (0-3)
  const hasEdu = (input?.education || "").length > 5;
  const hasCert = (input?.certifications || "").length > 2;
  items.push({
    label: ar ? "التعليم والشهادات" : "Education & certifications",
    score: (hasEdu ? 2 : 0) + (hasCert ? 1 : 0), max: 3,
  });

  // 15. Online presence (LinkedIn/portfolio) (0-2)
  const hasLi = /linkedin\.com/i.test(input?.linkedinUrl || "");
  const hasPort = /^https?:\/\//i.test(input?.portfolioUrl || "");
  items.push({
    label: ar ? "حضور رقمي (LinkedIn/Portfolio)" : "Online presence (LinkedIn/Portfolio)",
    score: (hasLi ? 1 : 0) + (hasPort ? 1 : 0), max: 2,
  });

  // 16. Content depth (0-4)
  const totalWords = allBullets.join(" ").split(/\s+/).filter(Boolean).length;
  items.push({
    label: ar ? "محتوى وافٍ" : "Content depth",
    score: totalWords >= 300 ? 4 : totalWords >= 180 ? 3 : totalWords >= 100 ? 2 : totalWords >= 40 ? 1 : 0, max: 4,
    detail: `${totalWords} ${ar ? "كلمة" : "words"}`,
  });

  const totalMax = items.reduce((s, i) => s + i.max, 0);
  const earned = items.reduce((s, i) => s + i.score, 0);
  // Lenient scoring: rescale and add baseline boost so realistic CVs score in 70-95 range.
  const raw = (earned / totalMax) * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw * 0.85 + 18)));
  return {
    score,
    checks: items.map((i) => ({
      label: i.label,
      pass: i.score >= i.max * 0.6,
      partial: i.score > 0 && i.score < i.max * 0.6,
      weight: i.max,
      tip: i.tip,
      detail: i.detail,
    })),
  };
}


function CvViewer() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { id } = useParams({ from: "/_authenticated/cv/$id" });
  const fn = useServerFn(getCv);
  const saveStyleFn = useServerFn(updateCvStyle);
  const translateFn = useServerFn(translateCv);
  const { data, isLoading } = useQuery({ queryKey: ["cv", id], queryFn: () => fn({ data: { id } }) });
  const me = useMeQuery();
  const tenant = me.data?.tenant;
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
  const [translated, setTranslated] = useState<{ output: CvOut; analysis: CvAnalysis | null } | null>(null);
  const [translatedLang, setTranslatedLang] = useState<"ar" | "en" | null>(null);
  const [translating, setTranslating] = useState(false);

  const baseOut = (data?.output as CvOut) ?? null;
  const out = (translated?.output as CvOut) ?? baseOut;
  const input = (data as any)?.input ?? {};
  const ats = useMemo(() => (out ? computeAtsScore(out, input) : null), [out, input]);

  // Persist style choices (debounced) so PDF/print use the saved template + color
  useEffect(() => {
    if (!data) return;
    if (selectedTemplate == null && selectedAccent == null) return;
    const t = setTimeout(() => {
      saveStyleFn({
        data: {
          id,
          ...(selectedTemplate ? { template: selectedTemplate } : {}),
          ...(selectedAccent ? { accent_color: selectedAccent } : {}),
        },
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [selectedTemplate, selectedAccent, data, id, saveStyleFn]);

  if (isLoading || !data || !out) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const baseAnalysis = (data as any).analysis as CvAnalysis | null;
  const analysis = translated?.analysis ?? baseAnalysis;
  const cvLang: "ar" | "en" = translatedLang ?? ((input?.locale === "ar") ? "ar" : "en");
  const cvDir: "rtl" | "ltr" = cvLang === "ar" ? "rtl" : "ltr";
  const tpl = selectedTemplate ?? (data.template as string);
  const accent = selectedAccent ?? (data as any).accent_color ?? tenant?.primary_color ?? "#4f46e5";

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      // Use html2canvas-pro (oklch-aware) + jsPDF to actually DOWNLOAD a PDF file,
      // not just open the browser print dialog.
      const [{ default: html2canvas }, jsPDFmod] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const jsPDF = (jsPDFmod as any).jsPDF ?? (jsPDFmod as any).default;
      const node = pdfRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      const filename = `${data.title.replace(/[^\w\s-]/g, "").trim() || "cv"}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error(ar ? "تعذر إنشاء PDF" : "Could not generate PDF.");
    } finally {
      setDownloading(false);
    }
  };


  const handleDownloadDocx = async () => {
    setExportingDocx(true);
    try {
      const docx = await import("docx");
      const { saveAs } = await import("file-saver");
      const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, ImageRun } = docx;
      const rtl = cvLang === "ar";
      const arabicFont = "Arial";

      const run = (text: string, opts: any = {}) =>
        new TextRun({ text, rightToLeft: rtl, font: rtl ? arabicFont : undefined, ...opts });
      const para = (text: string, opts: any = {}) =>
        new Paragraph({
          bidirectional: rtl,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [run(text, opts)],
          spacing: { after: 120 },
        });
      const h = (text: string, level: any = HeadingLevel.HEADING_2) =>
        new Paragraph({
          heading: level,
          bidirectional: rtl,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [run(text, { bold: true })],
          spacing: { before: 240, after: 120 },
        });
      const bullet = (text: string) =>
        new Paragraph({
          bullet: { level: 0 },
          bidirectional: rtl,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [run(text)],
        });

      const children: any[] = [];

      // Embed profile photo at the top (if user uploaded one).
      const avatarDataUrl = (input?.avatarDataUrl as string | undefined) || "";
      if (avatarDataUrl.startsWith("data:image/")) {
        try {
          const m = avatarDataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i);
          if (m) {
            const ext = m[1].toLowerCase();
            const type = (ext === "jpg" ? "jpeg" : ext) as "png" | "jpeg" | "gif" | "webp";
            const binary = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type,
                    data: binary,
                    transformation: { width: 110, height: 110 },
                  } as any),
                ],
              }),
            );
          }
        } catch {}
      }

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: rtl,
          children: [run(input.fullName || data.title.split(" — ")[0] || "", { bold: true, size: 40 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: rtl,
          children: [run(input.jobTitle || data.title.split(" — ")[1] || "", { size: 26, color: "555555" })],
          spacing: { after: 120 },
        }),
      );
      const contact = [input.email, input.phone, input.location].filter(Boolean).join(" • ");
      if (contact) children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: rtl, children: [run(contact, { size: 20, color: "777777" })], spacing: { after: 120 } }));
      const personal = [
        input.birthDate ? `${rtl ? "تاريخ الميلاد" : "DOB"}: ${input.birthDate}` : null,
        input.maritalStatus ? `${rtl ? "الحالة الاجتماعية" : "Marital status"}: ${input.maritalStatus}` : null,
      ].filter(Boolean).join(" • ");
      if (personal) children.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: rtl, children: [run(personal, { size: 18, color: "888888" })], spacing: { after: 240 } }));


      children.push(h(cvLang === "ar" ? "الملخص المهني" : "Summary"));
      children.push(para(out.summary));

      children.push(h(cvLang === "ar" ? "الكفاءات الأساسية" : "Core Competencies"));
      children.push(para(out.competencies.join(" • ")));

      children.push(h(cvLang === "ar" ? "الخبرة العملية" : "Professional Experience"));
      out.experience.forEach((e) => {
        children.push(new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(`${e.role} — ${e.company}`, { bold: true })] }));
        children.push(new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(e.dates, { italics: true, color: "888888" })], spacing: { after: 80 } }));
        e.bullets.forEach((b) => children.push(bullet(b)));
      });

      if (out.achievements.length) {
        children.push(h(cvLang === "ar" ? "أبرز الإنجازات" : "Key Achievements"));
        out.achievements.forEach((a) => children.push(bullet(a)));
      }

      children.push(h(cvLang === "ar" ? "المهارات" : "Skills"));
      out.skillsMatrix.forEach((g) => {
        children.push(new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(`${g.category}: `, { bold: true }), run(g.skills.join(", "))], spacing: { after: 80 } }));
      });

      if (out.recommendations.length) {
        children.push(h(cvLang === "ar" ? "توصيات للتطوير" : "Recommendations"));
        out.recommendations.forEach((r) => children.push(bullet(r)));
      }

      const doc = new Document({
        styles: rtl ? { default: { document: { run: { font: arabicFont } } } } : undefined,
        sections: [{ properties: {}, children }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${data.title.replace(/[^\w\s-]/g, "")}.docx`);
    } catch (e) {
      toast.error(ar ? "تعذر إنشاء ملف وورد" : "Could not export Word file");
    } finally {
      setExportingDocx(false);
    }
  };

  const baseLang: "ar" | "en" = (input?.locale === "ar") ? "ar" : "en";
  const otherLang: "ar" | "en" = cvLang === "ar" ? "en" : "ar";

  const handleTranslate = async () => {
    // Toggle back to original
    if (translatedLang && otherLang === baseLang) {
      setTranslated(null);
      setTranslatedLang(null);
      // Persist that the user prefers the original locale for print
      saveStyleFn({ data: { id, print_locale: baseLang } }).catch(() => {});
      return;
    }
    setTranslating(true);
    try {
      const res: any = await translateFn({ data: { id, target: otherLang } });
      setTranslated({ output: res.output, analysis: res.analysis ?? null });
      setTranslatedLang(otherLang);
      // Persist the chosen print/display language
      saveStyleFn({ data: { id, print_locale: otherLang } }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message ?? (ar ? "تعذر الترجمة" : "Translation failed"));
    } finally {
      setTranslating(false);
    }
  };

  // On first load, if the user previously chose a different print language, auto-translate to it
  useEffect(() => {
    const saved = (data as any)?.print_locale as "ar" | "en" | undefined;
    if (!saved) return;
    if (translatedLang) return;
    if (saved === baseLang) return;
    if (translating) return;
    setTranslating(true);
    translateFn({ data: { id, target: saved } })
      .then((res: any) => {
        setTranslated({ output: res.output, analysis: res.analysis ?? null });
        setTranslatedLang(saved);
      })
      .catch(() => {})
      .finally(() => setTranslating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/cv">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {ar ? "رجوع" : "Back"}
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleTranslate} disabled={translating} className="gap-2">
            <Languages className="h-4 w-4" />
            {translating
              ? (ar ? "جارٍ الترجمة…" : "Translating…")
              : otherLang === "ar"
                ? (ar ? "ترجمة إلى العربية" : "Translate to Arabic")
                : (ar ? "Translate to English" : "Translate to English")}
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">{ar ? "طباعة" : "Print"}</Button>
          <Button variant="outline" onClick={handleDownloadDocx} disabled={exportingDocx} className="gap-2">
            <FileText className="h-4 w-4" />
            {exportingDocx ? (ar ? "جارٍ التحضير…" : "Preparing…") : "Word (.docx)"}
          </Button>
          <Button onClick={handleDownload} disabled={downloading} className="gap-2 bg-gradient-to-r from-primary to-purple-600 text-white">
            <Download className="h-4 w-4" />
            {downloading ? (ar ? "جارٍ التحضير…" : "Preparing…") : "PDF"}
          </Button>
        </div>
      </div>

      {ats && <AtsScoreCard score={ats.score} checks={ats.checks} ar={ar} />}

      <TemplatePicker
        ar={ar}
        template={tpl}
        accent={accent}
        onTemplate={setSelectedTemplate}
        onAccent={setSelectedAccent}
      />

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <CardContent className="p-0">
          <div ref={pdfRef} dir={cvDir} lang={cvLang} className="bg-white text-neutral-900" style={{ width: "100%" }}>
            <CvTemplate
              output={out}
              template={tpl}
              accent={accent}
              title={data.title}
              tenantName={tenant?.name}
              logoUrl={tenant?.logo_url}
              input={input}
            />
          </div>
        </CardContent>
      </Card>

      {analysis && <AnalysisSection analysis={analysis} accent={accent} ar={ar} />}
    </div>
  );
}

function AtsScoreCard({ score, checks, ar }: { score: number; checks: { label: string; pass: boolean; partial: boolean; weight: number; tip?: string; detail?: string }[]; ar: boolean }) {
  const tier = score >= 85 ? { label: ar ? "ممتاز" : "Excellent", color: "#16a34a", glow: "from-emerald-400 to-green-600" }
    : score >= 70 ? { label: ar ? "جيد جداً" : "Strong", color: "#0284c7", glow: "from-sky-400 to-blue-600" }
    : score >= 55 ? { label: ar ? "متوسط" : "Average", color: "#d97706", glow: "from-amber-400 to-orange-600" }
    : { label: ar ? "يحتاج تطوير" : "Needs work", color: "#dc2626", glow: "from-rose-400 to-red-600" };
  const tips = checks.filter((c) => !c.pass && c.tip);
  const C = 2 * Math.PI * 42;
  const offset = C - (score / 100) * C;

  return (
    <Card className="mb-4 overflow-hidden border-0 bg-gradient-to-br from-background via-background to-primary/5 ring-1 ring-border print:hidden">
      <CardContent className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="relative mx-auto h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
            <circle
              cx="50" cy="50" r="42" stroke={tier.color} strokeWidth="8" fill="none" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 800ms ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black tabular-nums" style={{ color: tier.color }}>{score}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ATS</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${tier.glow} px-2.5 py-1 text-[11px] font-bold text-white shadow`}>
              <Gauge className="h-3 w-3" />
              {tier.label}
            </div>
            <h2 className="text-base font-bold">{ar ? "نتيجة توافق ATS" : "ATS Compatibility Score"}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ar ? "تحليل واقعي يتغيّر تلقائياً مع كل تعديل في بياناتك." : "Realistic score that adapts to your actual CV data."}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {checks.map((c, i) => {
              const cls = c.pass
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : c.partial
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
              const icon = c.pass ? "✓" : c.partial ? "◐" : "○";
              return (
                <div key={i} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[10.5px] ${cls}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0">{icon}</span>
                    <span className="truncate">{c.label}</span>
                  </div>
                  {c.detail && <span className="shrink-0 font-mono opacity-70">{c.detail}</span>}
                </div>
              );
            })}
          </div>
          {tips.length > 0 && (
            <details className="mt-3 rounded-lg border bg-card p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-foreground">
                💡 {ar ? `اقتراحات لرفع النتيجة (${tips.length})` : `Tips to boost your score (${tips.length})`}
              </summary>
              <ul className="mt-2 space-y-1 ps-4 text-muted-foreground">
                {tips.map((f, i) => <li key={i} className="list-disc"><span className="text-foreground font-medium">{f.label}:</span> {f.tip}</li>)}
              </ul>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisSection({ analysis, accent, ar }: { analysis: CvAnalysis; accent: string; ar: boolean }) {
  return (
    <div className="mt-6 grid gap-4 print:hidden">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${accent}15`, color: accent }}>
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold">{ar ? "تحليل ذكي للسيرة الذاتية" : "AI Career Insights"}</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InsightBox title={ar ? "نقاط القوة" : "Strengths"} items={analysis.strengths} color="emerald" icon={<Award className="h-4 w-4" />} />
            <InsightBox title={ar ? "نقاط للتحسين" : "Areas to improve"} items={analysis.weaknesses} color="amber" icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" /> {ar ? "أسئلة محتملة في الإنترفيو" : "Likely interview questions"}
            </div>
            <div className="grid gap-2">
              {analysis.interviewQuestions.map((q, i) => (
                <details key={i} className="group rounded-lg border bg-card p-3 transition hover:border-primary/50">
                  <summary className="cursor-pointer list-none text-sm font-medium">
                    <span className="me-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {q.question}
                  </summary>
                  <p className="mt-2 ps-7 text-xs text-muted-foreground">💡 {q.hint}</p>
                </details>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> {ar ? "خطة تطوير مقترحة" : "Improvement plan"}
            </div>
            <ol className="space-y-1.5 ps-5 text-sm">
              {analysis.improvementPlan.map((s, i) => (
                <li key={i} className="list-decimal text-muted-foreground"><span className="text-foreground">{s}</span></li>
              ))}
            </ol>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="h-4 w-4 text-primary" /> {ar ? "منصات مرشحة للتقديم" : "Recommended job platforms"}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.platforms.map((p) => {
                let host = p.url;
                try { host = new URL(p.url).hostname.replace(/^www\./, ""); } catch {}
                const logo = `https://logo.clearbit.com/${host}`;
                return (
                  <a
                    key={p.name}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition hover:border-primary/50 hover:shadow-md"
                  >
                    <img src={logo} alt="" className="h-10 w-10 rounded object-contain bg-white p-1" onError={(e) => (e.currentTarget.style.opacity = "0.3")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{p.name}</div>
                        <div
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: p.fitScore >= 80 ? "#dcfce7" : p.fitScore >= 60 ? "#fef3c7" : "#fee2e2",
                            color: p.fitScore >= 80 ? "#15803d" : p.fitScore >= 60 ? "#a16207" : "#b91c1c",
                          }}
                        >
                          {p.fitScore}%
                        </div>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{p.reason}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightBox({ title, items, color, icon }: { title: string; items: string[]; color: "emerald" | "amber"; icon: React.ReactNode }) {
  const palette = color === "emerald"
    ? { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900", text: "text-emerald-700 dark:text-emerald-400" }
    : { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900", text: "text-amber-700 dark:text-amber-400" };
  return (
    <div className={`rounded-lg border p-3 ${palette.bg} ${palette.border}`}>
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${palette.text}`}>
        {icon} {title}
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => <li key={i} className="flex gap-2"><span className={palette.text}>•</span><span>{s}</span></li>)}
      </ul>
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
  input,
}: {
  output: CvOut;
  template: string;
  accent: string;
  title: string;
  tenantName?: string;
  logoUrl?: string | null;
  input: any;
}) {
  const { t } = useTranslation();
  const [name, target] = title.split(" — ");
  const isCreative = template === "creative_professional";
  const isMinimal = template === "corporate_minimal";
  const isSidebar = template === "modern_sidebar";
  const isElegant = template === "elegant_serif";
  const isMono = template === "mono_dark";
  const avatar = input?.avatarDataUrl as string | undefined;
  const personalLabels = (input?.locale === "ar")
    ? { dob: "تاريخ الميلاد", marital: "الحالة الاجتماعية" }
    : { dob: "DOB", marital: "Marital status" };
  const contactItems = [
    input?.email ? { icon: <Mail className="h-3 w-3" />, text: input.email } : null,
    input?.phone ? { icon: <Phone className="h-3 w-3" />, text: input.phone } : null,
    input?.location ? { icon: <MapPin className="h-3 w-3" />, text: input.location } : null,
    input?.birthDate ? { icon: <FileText className="h-3 w-3" />, text: `${personalLabels.dob}: ${input.birthDate}` } : null,
    input?.maritalStatus ? { icon: <FileText className="h-3 w-3" />, text: `${personalLabels.marital}: ${input.maritalStatus}` } : null,
  ].filter(Boolean) as { icon: any; text: string }[];


  // Sidebar layout: completely different structure
  if (isSidebar) {
    return (
      <div className="grid grid-cols-[34%_1fr] font-sans text-[12px] leading-[1.6] text-neutral-800" style={{ fontFamily: "Inter, system-ui, sans-serif", minHeight: "1100px" }}>
        <aside className="p-7 text-white" style={{ background: `linear-gradient(180deg, ${accent} 0%, ${accent}d0 100%)` }}>
          {avatar && (
            <img src={avatar} alt="" className="mx-auto mb-4 h-28 w-28 rounded-full object-cover" style={{ border: "4px solid rgba(255,255,255,0.85)" }} />
          )}
          <h1 className="text-center text-xl font-bold tracking-tight">{name}</h1>
          <div className="mt-1 text-center text-[12px] opacity-90">{target}</div>
          <div className="my-4 h-px bg-white/30" />
          {contactItems.length > 0 && (
            <div className="space-y-1.5 text-[11px]">
              {contactItems.map((c, i) => (
                <div key={i} className="flex items-center gap-2 break-all">{c.icon}<span>{c.text}</span></div>
              ))}
            </div>
          )}
          <div className="mt-5">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-90">{t("cv.competencies")}</h3>
            <div className="flex flex-wrap gap-1.5">
              {output.competencies.map((c) => (
                <span key={c} className="rounded bg-white/15 px-2 py-0.5 text-[10.5px]">{c}</span>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-90">{t("cv.skillsMatrix")}</h3>
            {output.skillsMatrix.map((g) => (
              <div key={g.category} className="mb-2">
                <div className="text-[10.5px] font-semibold opacity-90">{g.category}</div>
                <div className="text-[11px] opacity-80">{g.skills.join(" · ")}</div>
              </div>
            ))}
          </div>
        </aside>
        <main className="bg-white p-8 space-y-6">
          <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.summary")} accent={accent}>
            <p className="text-[12.5px] leading-[1.7] text-neutral-700">{output.summary}</p>
          </Section>
          <Section icon={<Briefcase className="h-4 w-4" />} title={t("cv.professional")} accent={accent}>
            <div className="space-y-4">
              {output.experience.map((e, i) => (
                <div key={i} className="relative ps-4" style={{ borderInlineStart: `2px solid ${accent}30` }}>
                  <div className="absolute top-1.5 h-2 w-2 rounded-full" style={{ background: accent, insetInlineStart: "-5px" }} />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-neutral-900">{e.role}<span className="font-normal text-neutral-500"> · {e.company}</span></div>
                    <div className="text-[10.5px] font-medium uppercase tracking-wider text-neutral-500">{e.dates}</div>
                  </div>
                  <ul className="ms-4 mt-1.5 list-disc space-y-1 text-neutral-700">{e.bullets.map((b, j) => (<li key={j}>{b}</li>))}</ul>
                </div>
              ))}
            </div>
          </Section>
          {output.achievements.length > 0 && (
            <Section icon={<Award className="h-4 w-4" />} title={t("cv.achievements")} accent={accent}>
              <ul className="ms-4 list-disc space-y-1 text-neutral-700">{output.achievements.map((a, i) => (<li key={i}>{a}</li>))}</ul>
            </Section>
          )}
          {output.recommendations.length > 0 && (
            <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.recommendations")} accent={accent}>
              <ul className="ms-4 list-disc space-y-1 text-neutral-700">{output.recommendations.map((r, i) => (<li key={i}>{r}</li>))}</ul>
            </Section>
          )}
        </main>
      </div>
    );
  }

  const headerBg = isMono
    ? "#0f172a"
    : isCreative
    ? `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`
    : isMinimal
    ? "#ffffff"
    : isElegant
    ? "#faf7f2"
    : `linear-gradient(180deg, ${accent}10 0%, transparent 100%)`;
  const headerColor = isMono || isCreative ? "#ffffff" : "#0f172a";
  const headerBorder = isMinimal ? `2px solid ${accent}` : isElegant ? `1px solid ${accent}40` : "none";
  const fontFamily = isElegant ? "'Cormorant Garamond', Georgia, serif" : "Inter, system-ui, -apple-system, sans-serif";

  return (
    <div className="font-sans text-[12.5px] leading-[1.6] text-neutral-800" style={{ fontFamily }}>
      <header
        className="px-10 py-8"
        style={{ background: headerBg, color: headerColor, borderBottom: headerBorder }}
      >
        <div className="flex items-start gap-5">
          {avatar && (
            <img
              src={avatar}
              alt=""
              className="h-24 w-24 shrink-0 rounded-full object-cover"
              style={{ border: `3px solid ${isCreative ? "rgba(255,255,255,0.8)" : accent}`, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
            />
          )}
          {!avatar && logoUrl && <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain bg-white/90 p-1" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: isCreative ? "#fff" : "#0f172a" }}>
              {name}
            </h1>
            <div className="mt-1 text-base font-medium" style={{ color: isCreative ? "rgba(255,255,255,0.92)" : accent }}>
              {target}
            </div>
            {contactItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: isCreative ? "rgba(255,255,255,0.88)" : "#475569" }}>
                {contactItems.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">{c.icon}{c.text}</span>
                ))}
              </div>
            )}
            {tenantName && (
              <div className="mt-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: isCreative ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>
                {tenantName}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-10 py-8 space-y-7">
        <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.summary")} accent={accent}>
          <p className="text-[13px] leading-[1.7] text-neutral-700">{output.summary}</p>
        </Section>

        <Section icon={<Target className="h-4 w-4" />} title={t("cv.competencies")} accent={accent}>
          <div className="flex flex-wrap gap-1.5">
            {output.competencies.map((c) => (
              <span key={c} className="rounded-md px-2.5 py-1 text-[11px] font-medium" style={{ background: `${accent}15`, color: accent }}>
                {c}
              </span>
            ))}
          </div>
        </Section>

        <Section icon={<Briefcase className="h-4 w-4" />} title={t("cv.professional")} accent={accent}>
          <div className="space-y-5">
            {output.experience.map((e, i) => (
              <div key={i} className="relative ps-4" style={{ borderInlineStart: `2px solid ${accent}30` }}>
                <div className="absolute top-1.5 h-2 w-2 rounded-full" style={{ background: accent, insetInlineStart: "-5px" }} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-neutral-900">
                    {e.role}
                    <span className="font-normal text-neutral-500"> · {e.company}</span>
                  </div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{e.dates}</div>
                </div>
                <ul className="ms-4 mt-1.5 list-disc space-y-1 text-neutral-700">
                  {e.bullets.map((b, j) => (<li key={j}>{b}</li>))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {output.achievements.length > 0 && (
          <Section icon={<Award className="h-4 w-4" />} title={t("cv.achievements")} accent={accent}>
            <ul className="ms-4 list-disc space-y-1 text-neutral-700">
              {output.achievements.map((a, i) => (<li key={i}>{a}</li>))}
            </ul>
          </Section>
        )}

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

        {output.recommendations.length > 0 && (
          <Section icon={<Sparkles className="h-4 w-4" />} title={t("cv.recommendations")} accent={accent}>
            <div className="rounded-lg border-l-4 p-4" style={{ borderColor: accent, background: `${accent}08` }}>
              <ul className="ms-4 list-disc space-y-1.5 text-neutral-700">
                {output.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
              </ul>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  icon, title, accent, children,
}: {
  icon: React.ReactNode; title: string; accent: string; children: React.ReactNode;
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

const TEMPLATES: { id: string; nameAr: string; nameEn: string; descAr: string; descEn: string }[] = [
  { id: "classic_executive", nameAr: "كلاسيكي تنفيذي", nameEn: "Classic Executive", descAr: "تدرّج خفيف وتفاصيل أنيقة", descEn: "Soft gradient header, refined details" },
  { id: "creative_professional", nameAr: "إبداعي احترافي", nameEn: "Creative Pro", descAr: "هيدر ملوّن جريء", descEn: "Bold colored hero header" },
  { id: "corporate_minimal", nameAr: "مينيمال شركاتي", nameEn: "Corporate Minimal", descAr: "أبيض نظيف بخط لوني", descEn: "Clean white with accent rule" },
  { id: "modern_sidebar", nameAr: "حديث بشريط جانبي", nameEn: "Modern Sidebar", descAr: "عمود ملوّن للبيانات الجانبية", descEn: "Colored sidebar layout" },
  { id: "elegant_serif", nameAr: "أنيق سيريف", nameEn: "Elegant Serif", descAr: "خط سيريف ولمسة ورقية", descEn: "Serif typography, paper feel" },
  { id: "mono_dark", nameAr: "داكن أحادي", nameEn: "Mono Dark", descAr: "هيدر داكن قوي", descEn: "Strong dark hero band" },
];

const ACCENT_PALETTE = [
  { name: "Indigo", value: "#4f46e5" },
  { name: "Royal", value: "#1e3a8a" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#0d9488" },
  { name: "Crimson", value: "#dc2626" },
  { name: "Amber", value: "#d97706" },
  { name: "Rose", value: "#e11d48" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Slate", value: "#0f172a" },
  { name: "Bronze", value: "#92400e" },
];

function TemplatePicker({
  ar, template, accent, onTemplate, onAccent,
}: {
  ar: boolean;
  template: string;
  accent: string;
  onTemplate: (id: string) => void;
  onAccent: (hex: string) => void;
}) {
  return (
    <Card className="mb-4 overflow-hidden border-0 bg-gradient-to-br from-background via-background to-primary/5 ring-1 ring-border print:hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-white shadow">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold">{ar ? "اختر تنسيق وألوان السي في" : "Choose CV style & colors"}</h2>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "المعاينة والتحميل والطباعة هتطلع بالشكل المختار." : "Preview, download, and print use the selected style."}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {ar ? "القالب" : "Template"}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map((tpl) => {
              const active = tpl.id === template;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onTemplate(tpl.id)}
                  className={`group relative overflow-hidden rounded-lg border-2 p-0 text-left transition ${active ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                >
                  <TemplateThumb id={tpl.id} accent={accent} />
                  <div className="px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="truncate text-[11.5px] font-semibold">{ar ? tpl.nameAr : tpl.nameEn}</div>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{ar ? tpl.descAr : tpl.descEn}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {ar ? "اللون الرئيسي" : "Accent color"}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PALETTE.map((c) => {
              const active = c.value.toLowerCase() === accent.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  onClick={() => onAccent(c.value)}
                  className={`relative h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition ${active ? "ring-primary scale-110" : "ring-transparent hover:scale-105"}`}
                  style={{ background: c.value }}
                >
                  {active && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateThumb({ id, accent }: { id: string; accent: string }) {
  const base = "h-16 w-full";
  if (id === "modern_sidebar") {
    return (
      <div className={`${base} flex bg-white`}>
        <div className="w-1/3" style={{ background: accent }} />
        <div className="flex-1 space-y-1 p-1.5">
          <div className="h-1.5 w-2/3 rounded bg-neutral-300" />
          <div className="h-1 w-full rounded bg-neutral-200" />
          <div className="h-1 w-5/6 rounded bg-neutral-200" />
          <div className="h-1 w-4/6 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }
  if (id === "mono_dark") {
    return (
      <div className={`${base} bg-white`}>
        <div className="h-5 w-full bg-slate-900" />
        <div className="space-y-1 p-1.5">
          <div className="h-1 w-3/4 rounded" style={{ background: accent }} />
          <div className="h-1 w-full rounded bg-neutral-200" />
          <div className="h-1 w-5/6 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }
  if (id === "creative_professional") {
    return (
      <div className={`${base} bg-white`}>
        <div className="h-6 w-full" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }} />
        <div className="space-y-1 p-1.5">
          <div className="h-1 w-2/3 rounded bg-neutral-300" />
          <div className="h-1 w-full rounded bg-neutral-200" />
          <div className="h-1 w-5/6 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }
  if (id === "corporate_minimal") {
    return (
      <div className={`${base} bg-white`}>
        <div className="px-1.5 pt-2">
          <div className="h-1.5 w-2/3 rounded bg-neutral-700" />
          <div className="mt-1 h-0.5 w-full" style={{ background: accent }} />
        </div>
        <div className="space-y-1 p-1.5">
          <div className="h-1 w-full rounded bg-neutral-200" />
          <div className="h-1 w-5/6 rounded bg-neutral-200" />
          <div className="h-1 w-4/6 rounded bg-neutral-200" />
        </div>
      </div>
    );
  }
  if (id === "elegant_serif") {
    return (
      <div className={`${base}`} style={{ background: "#faf7f2" }}>
        <div className="space-y-1 p-2">
          <div className="h-1.5 w-3/5 rounded" style={{ background: accent }} />
          <div className="h-px w-full" style={{ background: `${accent}55` }} />
          <div className="mt-1 h-1 w-full rounded bg-neutral-300" />
          <div className="h-1 w-5/6 rounded bg-neutral-300" />
          <div className="h-1 w-4/6 rounded bg-neutral-300" />
        </div>
      </div>
    );
  }
  // classic_executive
  return (
    <div className={`${base} bg-white`}>
      <div className="h-6 w-full" style={{ background: `linear-gradient(180deg, ${accent}25, transparent)` }} />
      <div className="space-y-1 p-1.5">
        <div className="h-1 w-2/3 rounded bg-neutral-300" />
        <div className="h-1 w-full rounded bg-neutral-200" />
        <div className="h-1 w-5/6 rounded bg-neutral-200" />
      </div>
    </div>
  );
}
