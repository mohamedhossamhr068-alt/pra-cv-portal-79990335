import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CvOutputSchema = z.object({
  summary: z.string(),
  competencies: z.array(z.string()),
  experience: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  achievements: z.array(z.string()),
  skillsMatrix: z.array(z.object({ category: z.string(), skills: z.array(z.string()) })),
  recommendations: z.array(z.string()),
});

const CvInputSchema = z.object({
  fullName: z.string().min(1).max(120),
  jobTitle: z.string().min(1).max(120),
  industry: z.string().min(1).max(80),
  seniority: z.enum(["junior", "mid", "senior", "lead"]),
  experience: z.string().min(20).max(4000),
  skills: z.string().min(1).max(1000),
  template: z.enum(["modern_executive", "corporate_minimal", "creative_professional"]).default("modern_executive"),
  locale: z.enum(["en", "ar"]).default("en"),
});

type CvInput = z.infer<typeof CvInputSchema>;
type CvOutput = z.infer<typeof CvOutputSchema>;

function extractJsonObject(text: string) {
  const withoutFence = text.replace(/```(?:json)?/gi, "```").replace(/```/g, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("AI response did not contain JSON.");
  return JSON.parse(withoutFence.slice(start, end + 1));
}

function splitSkills(skills: string) {
  return skills
    .split(/[,،\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeCvOutput(raw: unknown, input: CvInput): CvOutput {
  const candidate = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const skills = splitSkills(input.skills);
  const fallbackSummary =
    input.locale === "ar"
      ? `${input.jobTitle} متخصص في ${input.industry} بخبرة عملية تشمل ${input.experience.slice(0, 180)}.`
      : `${input.jobTitle} professional in ${input.industry} with practical experience across ${input.experience.slice(0, 180)}.`;

  const experience = Array.isArray(candidate.experience)
    ? candidate.experience
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            role: String(row.role || input.jobTitle).trim(),
            company: String(row.company || (input.locale === "ar" ? "غير محدد" : "Not specified")).trim(),
            dates: String(row.dates || (input.locale === "ar" ? "غير محدد" : "Not specified")).trim(),
            bullets: stringArray(row.bullets),
          };
        })
        .filter((item) => item.role && item.bullets.length)
    : [];

  const skillsMatrix = Array.isArray(candidate.skillsMatrix)
    ? candidate.skillsMatrix
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            category: String(row.category || (input.locale === "ar" ? "المهارات" : "Core skills")).trim(),
            skills: stringArray(row.skills),
          };
        })
        .filter((item) => item.category && item.skills.length)
    : [];

  return {
    summary: String(candidate.summary || fallbackSummary).trim(),
    competencies: stringArray(candidate.competencies).length ? stringArray(candidate.competencies) : skills,
    experience: experience.length
      ? experience
      : [
          {
            role: input.jobTitle,
            company: input.locale === "ar" ? "غير محدد" : "Not specified",
            dates: input.locale === "ar" ? "غير محدد" : "Not specified",
            bullets: [input.experience.trim()],
          },
        ],
    achievements: stringArray(candidate.achievements),
    skillsMatrix: skillsMatrix.length
      ? skillsMatrix
      : [{ category: input.locale === "ar" ? "المهارات الأساسية" : "Core skills", skills }],
    recommendations: stringArray(candidate.recommendations),
  };
}

export const generateCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CvInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tenantId = profile?.tenant_id ?? null;
    const { data: sub } = tenantId
      ? await supabase.from("subscriptions").select("plan").eq("tenant_id", tenantId).maybeSingle()
      : { data: null };
    const plan = (sub?.plan as string) ?? "free";
    const planLimits: Record<string, number> = { free: 3, pro: 50, business: 9999 };
    const limit = planLimits[plan] ?? 3;

    const monthKey = new Date().toISOString().slice(0, 7);
    const { data: existing } = await supabase
      .from("usage_quotas")
      .select("*")
      .eq("user_id", userId)
      .eq("period_month", monthKey)
      .maybeSingle();
    const used = existing?.cv_generations_used ?? 0;
    if (used >= limit) throw new Error("QUOTA_REACHED");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const langInstr =
      data.locale === "ar"
        ? "Write all CV content in Modern Standard Arabic. Use professional, HR-grade Arabic suitable for the GCC market."
        : "Write all CV content in professional, ATS-friendly English.";

    let cvOutput: CvOutput;
    try {
      const result = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        maxOutputTokens: 8192,
        system: `You are a senior HR writer producing ATS-optimized CVs. Strict rules:
- Do NOT invent companies, dates, titles, or achievements the candidate did not provide.
- Rewrite, structure, and quantify only what is implied by the user's inputs.
- When numbers are not provided, write qualitative bullets — never fake metrics.
- Use action verbs, concise lines, no first person, no clichés.
- ${langInstr}
- Return only one valid JSON object. No markdown, no prose outside JSON.`,
        prompt: `Candidate: ${data.fullName}
Target role: ${data.jobTitle}
Industry: ${data.industry}
Seniority: ${data.seniority}
Skills (raw): ${data.skills}
Experience (raw): ${data.experience}

Produce an ATS-optimized CV with exactly these JSON keys:
{
  "summary": "string",
  "competencies": ["string"],
  "experience": [{ "role": "string", "company": "string", "dates": "string", "bullets": ["string"] }],
  "achievements": ["string"],
  "skillsMatrix": [{ "category": "string", "skills": ["string"] }],
  "recommendations": ["string"]
}`,
      });
      cvOutput = normalizeCvOutput(extractJsonObject(result.text), data);
      CvOutputSchema.parse(cvOutput);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("AI rate limit reached. Please try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted on this workspace.");
      cvOutput = normalizeCvOutput(null, data);
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("cv_logs")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        title: `${data.fullName} — ${data.jobTitle}`,
        template: data.template,
        input: data as any,
        output: cvOutput as any,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    await supabase.from("usage_quotas").upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        period_month: monthKey,
        cv_generations_used: used + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period_month" },
    );

    await supabase.from("usage_events").insert({
      user_id: userId,
      tenant_id: tenantId,
      action_type: "cv_generated",
      metadata: { template: data.template, locale: data.locale } as any,
    });

    return { id: inserted.id, output: cvOutput };
  });

export const listCvs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("cv_logs")
      .select("id,title,template,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getCv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cv } = await supabase
      .from("cv_logs")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!cv) throw new Error("Not found");
    return cv;
  });

export const deleteCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("cv_logs").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });
