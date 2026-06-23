import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/new")({
  component: NewCv,
});

function NewCv() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const me = useMeQuery();
  const fn = useServerFn(generateCv);

  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    industry: "",
    seniority: "mid" as "junior" | "mid" | "senior" | "lead",
    experience: "",
    skills: "",
    template: "modern_executive" as "modern_executive" | "corporate_minimal" | "creative_professional",
  });

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: { ...form, locale: (i18n.language === "ar" ? "ar" : "en") as "en" | "ar" },
      }),
    onSuccess: (res) => {
      toast.success("CV generated");
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
            <Label>{t("cv.industry")}</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
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
                  toast.error("Please fill in name, job title, and industry.");
                  return;
                }
                if (form.skills.trim().length < 1) {
                  toast.error("Please list at least one skill.");
                  return;
                }
                if (form.experience.trim().length < 20) {
                  toast.error("Please describe your experience in at least 20 characters.");
                  return;
                }
                mut.mutate();
              }}
              disabled={mut.isPending || quotaUsed}
              className="gap-2"
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
