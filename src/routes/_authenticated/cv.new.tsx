import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv } from "@/lib/cv.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/new")({
  component: NewCv,
});

const TEMPLATES = [
  { id: "ats_clean", ar: "ATS نظيف (موصى به)", en: "ATS Clean (Recommended)" },
  { id: "two_column_modern", ar: "عمودين حديث", en: "Two-Column Modern" },
  { id: "classic_executive", ar: "كلاسيكي تنفيذي", en: "Classic Executive" },
  { id: "creative_professional", ar: "إبداعي احترافي", en: "Creative Pro" },
  { id: "corporate_minimal", ar: "مينيمال شركاتي", en: "Corporate Minimal" },
  { id: "modern_sidebar", ar: "حديث بشريط جانبي", en: "Modern Sidebar" },
  { id: "elegant_serif", ar: "أنيق سيريف", en: "Elegant Serif" },
  { id: "mono_dark", ar: "داكن أحادي", en: "Mono Dark" },
];

function NewCv() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const fn = useServerFn(generateCv);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    industry: "",
    seniority: "mid" as "junior" | "mid" | "senior" | "lead",
    yearsExperience: "",
    experience: "",
    skills: "",
    education: "",
    certifications: "",
    englishLevel: "intermediate" as "none" | "basic" | "intermediate" | "advanced" | "fluent" | "native",
    erp: "",
    linkedinUrl: "",
    portfolioUrl: "",
    template: "ats_clean",
    avatarDataUrl: "",
    email: "",
    phone: "",
    location: "",
  });

  function onPickAvatar(file: File) {
    if (file.size > 300_000) return toast.error(ar ? "الصورة كبيرة (حد أقصى 300KB)" : "Image too large (max 300KB)");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ...form,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
          locale: ar ? "ar" : "en",
        } as any,
      }),
    onSuccess: (res: any) => {
      toast.success(ar ? "تم إنشاء السي في" : "CV generated");
      navigate({ to: `/cv/${res.id}` });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const canSubmit =
    form.fullName.trim() &&
    form.jobTitle.trim() &&
    form.industry.trim() &&
    form.experience.trim().length >= 20 &&
    form.skills.trim();

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {ar ? "إنشاء سي في جديد" : "Create a new CV"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-3">
            {form.avatarDataUrl ? (
              <div className="relative">
                <img src={form.avatarDataUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, avatarDataUrl: "" })}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onPickAvatar(e.target.files[0])}
            />
            <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {ar ? "صورة شخصية" : "Photo"}
            </Button>
          </div>

          <div>
            <Label>{ar ? "الاسم الكامل" : "Full Name"} *</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "المسمى الوظيفي" : "Job Title"} *</Label>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "المجال" : "Industry"} *</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "سنوات الخبرة" : "Years of Experience"}</Label>
            <Input
              type="number"
              min={0}
              value={form.yearsExperience}
              onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
            />
          </div>
          <div>
            <Label>{ar ? "المستوى" : "Seniority"}</Label>
            <Select value={form.seniority} onValueChange={(v: any) => setForm({ ...form, seniority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{ar ? "مستوى الإنجليزي" : "English Level"}</Label>
            <Select value={form.englishLevel} onValueChange={(v: any) => setForm({ ...form, englishLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="fluent">Fluent</SelectItem>
                <SelectItem value="native">Native</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{ar ? "البريد" : "Email"}</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "الهاتف" : "Phone"}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{ar ? "العنوان" : "Location"}</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <Label>{ar ? "الخبرات (شركة - دور - فترة - نقاط)" : "Experience (company - role - period - bullets)"} *</Label>
            <Textarea
              rows={6}
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              placeholder={ar ? "اكتب خبراتك بالتفصيل (20 حرف على الأقل)" : "Describe your experience (min 20 chars)"}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{ar ? "المهارات (مفصولة بفواصل)" : "Skills (comma separated)"} *</Label>
            <Textarea
              rows={3}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </div>
          <div>
            <Label>{ar ? "التعليم" : "Education"}</Label>
            <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "الشهادات" : "Certifications"}</Label>
            <Input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "البورتفوليو" : "Portfolio"}</Label>
            <Input value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <Label>{ar ? "القالب" : "Template"}</Label>
            <Select value={form.template} onValueChange={(v) => setForm({ ...form, template: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{ar ? t.ar : t.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Button
              onClick={() => mut.mutate()}
              disabled={!canSubmit || mut.isPending}
              className="w-full"
            >
              {mut.isPending ? (ar ? "جاري الإنشاء..." : "Generating...") : (ar ? "إنشاء السي في" : "Generate CV")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
