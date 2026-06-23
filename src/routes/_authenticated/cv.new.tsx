import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, User, Mail, Phone, MapPin, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/new")({
  component: NewCv,
});

async function resizeImageToDataUrl(file: File, maxSize = 360): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = blobUrl;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function NewCv() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const me = useMeQuery();
  const fn = useServerFn(generateCv);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    industry: "",
    seniority: "mid" as "junior" | "mid" | "senior" | "lead",
    experience: "",
    skills: "",
    template: "modern_executive" as "modern_executive" | "corporate_minimal" | "creative_professional",
    avatarDataUrl: "" as string,
    email: "",
    phone: "",
    location: "",
  });

  const onPickAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error(ar ? "ملف غير صالح" : "Invalid image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(ar ? "حجم الصورة كبير" : "Too large"); return; }
    try {
      const url = await resizeImageToDataUrl(file);
      setForm((f) => ({ ...f, avatarDataUrl: url }));
    } catch {
      toast.error(ar ? "تعذر تحميل الصورة" : "Could not load image");
    }
  };

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ...form,
          avatarDataUrl: form.avatarDataUrl || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          location: form.location || undefined,
          locale: (ar ? "ar" : "en") as "en" | "ar",
        },
      }),
    onSuccess: (res) => {
      toast.success(ar ? "تم إنشاء السيرة" : "CV generated");
      navigate({ to: "/cv/$id", params: { id: res.id } });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("QUOTA_REACHED")) toast.error(t("cv.quotaReached"));
      else toast.error(msg || "Failed");
    },
  });

  const quotaUsed = (me.data?.quota?.remaining ?? 0) <= 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cv.new")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.data?.quota?.remaining ?? 0} / {me.data?.quota?.limit ?? 0} {t("dashboard.quotaRemaining").toLowerCase()}
        </p>
      </div>

      <Card className="mb-4 overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 ring-1 ring-border">
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <div className="relative">
            {form.avatarDataUrl ? (
              <>
                <img src={form.avatarDataUrl} alt="" className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-primary/30" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, avatarDataUrl: "" })}
                  className="absolute -end-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-2xl bg-muted/60 text-muted-foreground ring-2 ring-dashed ring-border">
                <User className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-start">
            <div className="text-sm font-semibold">{ar ? "صورة شخصية (اختياري)" : "Profile photo (optional)"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {ar ? "JPG / PNG حتى 5MB — يتم تصغيرها تلقائياً" : "JPG / PNG up to 5MB — auto-resized"}
            </div>
            <div className="mt-3 flex justify-center gap-2 sm:justify-start">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickAvatar(f); e.target.value = ""; }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                {form.avatarDataUrl ? (ar ? "تغيير الصورة" : "Change") : (ar ? "رفع صورة" : "Upload")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("cv.inputs")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("cv.fullName")}</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>{t("cv.title")}</Label>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{ar ? "رقم الهاتف" : "Phone"}</Label>
            <Input placeholder="+20 1xx xxx xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ar ? "الموقع" : "Location"}</Label>
            <Input placeholder={ar ? "القاهرة، مصر" : "Cairo, Egypt"} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>{t("cv.industry")}</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("cv.seniority")}</Label>
            <Select value={form.seniority} onValueChange={(v: any) => setForm({ ...form, seniority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">{t("cv.seniorityJunior")}</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">{t("cv.senioritySenior")}</SelectItem>
                <SelectItem value="lead">Lead / Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>{t("cv.skills")}</Label>
            <Input placeholder="React, TypeScript, PostgreSQL…" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("cv.experience")}</Label>
            <Textarea rows={8} placeholder={t("cv.experiencePlaceholder")} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("cv.template")}</Label>
            <Select value={form.template} onValueChange={(v: any) => setForm({ ...form, template: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern_executive">{t("cv.templateModern")}</SelectItem>
                <SelectItem value="corporate_minimal">{t("cv.templateCorporate")}</SelectItem>
                <SelectItem value="creative_professional">{t("cv.templateCreative")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={() => {
                if (!form.fullName.trim() || !form.jobTitle.trim() || !form.industry.trim()) {
                  toast.error(ar ? "الاسم والوظيفة والمجال مطلوبون." : "Please fill in name, job title, and industry.");
                  return;
                }
                if (form.skills.trim().length < 1) {
                  toast.error(ar ? "أضف مهارة واحدة على الأقل." : "Please list at least one skill.");
                  return;
                }
                if (form.experience.trim().length < 20) {
                  toast.error(ar ? "اكتب وصف خبرتك بـ 20 حرف على الأقل." : "Please describe your experience in at least 20 characters.");
                  return;
                }
                mut.mutate();
              }}
              disabled={mut.isPending || quotaUsed}
              size="lg"
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" />
              {mut.isPending ? t("cv.generating") : t("cv.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
