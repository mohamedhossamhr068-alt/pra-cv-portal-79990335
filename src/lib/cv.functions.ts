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

const LanguageSchema = z.object({
  name: z.string().min(1).max(40),
  level: z.string().min(1).max(30),
});

const CvInputSchema = z.object({
  fullName: z.string().min(1).max(120),
  jobTitle: z.string().min(1).max(120),
  industry: z.string().min(1).max(80),
  seniority: z.enum(["junior", "mid", "senior", "lead"]),
  experience: z.string().min(20).max(4000),
  skills: z.string().min(1).max(1000),
  template: z.enum([
    "ats_clean",
    "two_column_modern",
    "classic_executive",
    "creative_professional",
    "corporate_minimal",
    "modern_sidebar",
    "elegant_serif",
    "mono_dark",
    // legacy values kept for backward compat
    "modern_executive",
  ]).default("ats_clean"),
  locale: z.enum(["en", "ar"]).default("en"),
  avatarDataUrl: z.string().max(400_000).optional(),
  email: z.string().max(160).optional(),
  phone: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  englishLevel: z.enum(["none", "basic", "intermediate", "advanced", "fluent", "native"]).optional(),
  languages: z.array(LanguageSchema).max(8).optional(),
  erp: z.string().max(120).optional(),
  yearsExperience: z.coerce.number().min(0).max(60).optional(),
  education: z.string().max(400).optional(),
  certifications: z.string().max(600).optional(),
  linkedinUrl: z.string().max(200).optional(),
  portfolioUrl: z.string().max(200).optional(),
  birthDate: z.string().max(40).optional(),
  maritalStatus: z.string().max(40).optional(),
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

  const recos = stringArray(candidate.recommendations);
  const fallbackRecos =
    input.locale === "ar"
      ? [
          "أضف مقاييس قابلة للقياس (نسب نمو، توفير تكلفة، حجم فريق) لكل إنجاز.",
          "ادعم ملفك بشهادات معتمدة في مجالك لزيادة الثقة لدى صاحب العمل.",
          "حدّث ملفك على لينكدإن ليطابق الكلمات المفتاحية في هذه السيرة.",
          "أضف رابط أعمالك أو منصة GitHub لإظهار نتائج ملموسة.",
        ]
      : [
          "Quantify every achievement with metrics (%, $, team size, time saved).",
          "Add 1–2 industry certifications relevant to the target role to strengthen credibility.",
          "Mirror these keywords on your LinkedIn headline and About section.",
          "Link a portfolio, GitHub, or case study to show tangible outcomes.",
        ];

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
    recommendations: recos.length ? recos : fallbackRecos,
  };
}


async function getCvCost(supabase: any, tenantId: string | null): Promise<number> {
  if (!tenantId) return 5;
  const { data } = await supabase.from("tenants").select("cv_credit_cost").eq("id", tenantId).maybeSingle();
  return (data as any)?.cv_credit_cost ?? 5;
}

async function generateAnalysis(
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  cv: CvOutput,
  input: CvInput,
) {
  const lang = input.locale === "ar" ? "Arabic" : "English";
  try {
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      maxOutputTokens: 4096,
      system: `You are a senior career coach. Output only one JSON object in ${lang}. Keys: strengths (array of 4-6 strings), weaknesses (array of 3-5 strings), interviewQuestions (array of 6-8 objects each {question, hint}), improvementPlan (array of 4-6 strings), platforms (array of 4-6 objects each {name, url, fitScore: number 0-100, reason}). The platforms must be real Egypt job boards (LinkedIn, Wuzzuf, Bayt, Forasna, Indeed Egypt, NaukriGulf, Tanqeeb). Score how well this candidate fits each platform.`,
      prompt: `Candidate: ${input.fullName}, Role: ${input.jobTitle}, Industry: ${input.industry}, Seniority: ${input.seniority}\nSummary: ${cv.summary}\nSkills: ${cv.competencies.join(", ")}`,
    });
    return normalizeAnalysis(extractJsonObject(result.text), input);
  } catch {
    return normalizeAnalysis(null, input);
  }
}

function normalizeAnalysis(raw: unknown, input: CvInput) {
  const c = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const ar = input.locale === "ar";
  const platforms = Array.isArray(c.platforms) ? c.platforms : [];
  const defaultPlatforms = [
    { name: "LinkedIn", url: "https://linkedin.com/jobs", fitScore: 88, reason: ar ? "أقوى منصة للوظائف الاحترافية في مصر." : "Strongest professional network in Egypt." },
    { name: "Wuzzuf", url: "https://wuzzuf.net", fitScore: 92, reason: ar ? "المنصة الأشهر للوظائف المحلية في مصر." : "Leading local Egyptian job board." },
    { name: "Bayt", url: "https://www.bayt.com/en/egypt", fitScore: 78, reason: ar ? "وظائف الشرق الأوسط، مناسبة لو بتفكر في الخليج." : "MENA-wide reach if open to Gulf relocation." },
    { name: "Forasna", url: "https://forasna.com", fitScore: 70, reason: ar ? "وظائف ذوي الياقات الزرقاء والمتوسطة." : "Blue/mid-collar opportunities in Egypt." },
  ];
  return {
    strengths: stringArray(c.strengths).length ? stringArray(c.strengths) : [
      ar ? "خلفية واضحة في المجال المستهدف." : "Clear background in the target field.",
      ar ? "مهارات تقنية تتطابق مع متطلبات السوق." : "Technical skills aligned with market demand.",
    ],
    weaknesses: stringArray(c.weaknesses).length ? stringArray(c.weaknesses) : [
      ar ? "بعض الإنجازات تحتاج أرقام قابلة للقياس." : "Quantify achievements with metrics.",
      ar ? "أضف شهادات معتمدة لتعزيز المصداقية." : "Add certifications for credibility.",
    ],
    interviewQuestions: Array.isArray(c.interviewQuestions) && c.interviewQuestions.length
      ? c.interviewQuestions.map((q: any) => ({
          question: String(q?.question ?? "").trim(),
          hint: String(q?.hint ?? "").trim(),
        })).filter((q: any) => q.question)
      : [
          { question: ar ? "احكيلي عن نفسك في دقيقتين." : "Tell me about yourself in 2 minutes.", hint: ar ? "ابدأ بدور حالي → خبرة سابقة → سبب اهتمامك بالدور." : "Current → past → why this role." },
          { question: ar ? "إيه أكبر تحدي قابلته وحليته إزاي؟" : "Biggest challenge and how you solved it?", hint: ar ? "استخدم STAR: Situation, Task, Action, Result." : "Use STAR framework." },
          { question: ar ? "ليه الشركة دي بالذات؟" : "Why this company?", hint: ar ? "اربط بمنتجها وقيمها وخطتك معاها." : "Tie product, values, your plan." },
        ],
    improvementPlan: stringArray(c.improvementPlan).length ? stringArray(c.improvementPlan) : [
      ar ? "أكمل شهادة معتمدة خلال 60 يوم." : "Complete one certification in 60 days.",
      ar ? "اعمل بروجكت portfolio منشور خلال شهر." : "Ship a public portfolio project in 30 days.",
      ar ? "حدّث الـ LinkedIn بنفس الكلمات المفتاحية." : "Mirror these keywords on LinkedIn.",
    ],
    platforms: platforms.length
      ? platforms.map((p: any) => ({
          name: String(p?.name ?? "").trim(),
          url: String(p?.url ?? "").trim(),
          fitScore: Math.min(100, Math.max(0, Number(p?.fitScore ?? 70))),
          reason: String(p?.reason ?? "").trim(),
        })).filter((p: any) => p.name && p.url)
      : defaultPlatforms,
  };
}

export const generateCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CvInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    try {
      const result = await generateCvInner({ data, context });
      await supabase.rpc("log_audit" as any, {
        _action: "cv.generated",
        _status: "success",
        _target: data.fullName + " — " + data.jobTitle,
        _link: `/cv/${result.id}`,
        _metadata: { template: data.template, locale: data.locale, cv_id: result.id } as any,
      });
      return result;
    } catch (e: any) {
      await supabase.rpc("log_audit" as any, {
        _action: "cv.generated",
        _status: "failure",
        _target: data.fullName + " — " + data.jobTitle,
        _link: null,
        _metadata: { error: String(e?.message ?? e), template: data.template } as any,
      });
      throw e;
    }
  });

async function generateCvInner({ data, context }: { data: CvInput; context: any }) {

    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id,credits,is_blocked")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_blocked) throw new Error("ACCOUNT_BLOCKED");
    const tenantId = profile?.tenant_id ?? null;
    const CV_CREDIT_COST = await getCvCost(supabase, tenantId);

    const { data: sub } = tenantId
      ? await supabase.from("subscriptions").select("plan").eq("tenant_id", tenantId).maybeSingle()
      : { data: null };
    const plan = (sub?.plan as string) ?? "free";
    const planLimits: Record<string, number> = { free: 3, pro: 50, business: 9999 };
    const limit = planLimits[plan] ?? 3;

    const monthKey = new Date().toISOString().slice(0, 7);

    // Atomically check + deduct credits and bump the monthly quota in one
    // locked transaction, so concurrent requests (double-click, multiple
    // tabs) cannot both pass the check against the same stale balance.
    // See migration 20260625120000_fix_credit_race_condition.sql.
    const { data: reserveRows, error: reserveErr } = await supabase.rpc(
      "reserve_cv_generation" as any,
      {
        _user_id: userId,
        _tenant_id: tenantId,
        _period_month: monthKey,
        _plan_limit: limit,
      },
    );
    if (reserveErr) {
      const msg = reserveErr.message || "";
      if (msg.includes("NO_CREDITS")) throw new Error("NO_CREDITS");
      if (msg.includes("QUOTA_REACHED")) throw new Error("QUOTA_REACHED");
      if (msg.includes("ACCOUNT_BLOCKED")) throw new Error("ACCOUNT_BLOCKED");
      throw reserveErr;
    }
    const reserved = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
    const creditsLeftAfterReserve: number = reserved?.credits_left ?? 0;

    // From here on, if anything fails we must refund the reservation —
    // otherwise a failed generation would still cost the user credits/quota.
    const refund = async () => {
      try {
        await supabase.rpc("refund_cv_generation" as any, {
          _user_id: userId,
          _tenant_id: tenantId,
          _period_month: monthKey,
          _cost: CV_CREDIT_COST,
        });
      } catch (e) {
        console.error("refund_cv_generation failed", e);
      }
    };

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
Years of experience: ${data.yearsExperience ?? "not provided"}
English level: ${data.englishLevel ?? "not provided"}
Other languages: ${(data.languages ?? []).map((l) => `${l.name} (${l.level})`).join(", ") || "not provided"}
ERP / Systems: ${data.erp || "not provided"}
Education: ${data.education || "not provided"}
Certifications: ${data.certifications || "not provided"}
LinkedIn: ${data.linkedinUrl || "not provided"}
Portfolio: ${data.portfolioUrl || "not provided"}
Date of birth: ${data.birthDate || "not provided"}
Marital status: ${data.maritalStatus || "not provided"}
Skills (raw): ${data.skills}
Experience (raw — companies, dates, responsibilities described by candidate):
${data.experience}

IMPORTANT: From the "Experience (raw)" text, extract each distinct company/employer the candidate mentions and create one entry per company in the "experience" array, populating "role", "company", and "dates" exactly as the candidate wrote them. Never merge multiple jobs into one entry. If dates are missing for a job, write "Not specified" — do NOT invent dates.



Produce an ATS-optimized CV with exactly these JSON keys:
{
  "summary": "string",
  "competencies": ["string"],
  "experience": [{ "role": "string", "company": "string", "dates": "string", "bullets": ["string"] }],
  "achievements": ["string"],
  "skillsMatrix": [{ "category": "string", "skills": ["string"] }],
  "recommendations": ["string"]
}
If languages or ERP systems were provided, include them as their own skillsMatrix categories ("Languages", "ERP & Systems"). Do not invent numbers; reflect the candidate's English level and ERP exposure faithfully.`,
      });
      cvOutput = normalizeCvOutput(extractJsonObject(result.text), data);
      CvOutputSchema.parse(cvOutput);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) {
        await refund();
        throw new Error("AI rate limit reached. Please try again shortly.");
      }
      if (msg.includes("402")) {
        await refund();
        throw new Error("AI credits exhausted on this workspace.");
      }
      cvOutput = normalizeCvOutput(null, data);
    }

    const analysis = await generateAnalysis(gateway, cvOutput, data);

    const { data: inserted, error: insertErr } = await supabase
      .from("cv_logs")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        title: `${data.fullName} — ${data.jobTitle}`,
        template: data.template,
        input: data as any,
        output: cvOutput as any,
        analysis: analysis as any,
      })
      .select()
      .single();
    if (insertErr) {
      // The reservation already deducted credits/quota; since the CV was
      // never actually saved, refund it rather than charging for nothing.
      await refund();
      throw insertErr;
    }

    // Credits and the monthly quota were already deducted atomically by
    // reserve_cv_generation() above — do not deduct again here.
    await supabase.from("usage_events").insert({
      user_id: userId,
      tenant_id: tenantId,
      action_type: "cv_generated",
      metadata: { template: data.template, locale: data.locale, cost: CV_CREDIT_COST } as any,
    });

    return { id: inserted.id, output: cvOutput, analysis, creditsLeft: creditsLeftAfterReserve };
}



export const listCvs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tenantId = prof?.tenant_id ?? null;
    let isAdmin = false;
    if (tenantId) {
      const { data: a } = await supabase.rpc("is_tenant_admin", { _user_id: userId, _tenant_id: tenantId });
      isAdmin = !!a;
    }
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: userId });

    let query = supabase
      .from("cv_logs")
      .select("id,title,template,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (isSuper) {
      // all
    } else if (isAdmin && tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.eq("user_id", userId);
    }
    const { data: cvs } = await query;
    const list = (cvs ?? []) as any[];
    const ids = Array.from(new Set(list.map((c) => c.user_id).filter(Boolean)));
    let profilesById = new Map<string, { full_name: string | null; email: string | null }>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      profilesById = new Map((ps ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
    }
    return list.map((c) => ({
      id: c.id,
      title: c.title,
      template: c.template,
      created_at: c.created_at,
      user_id: c.user_id,
      owner_name: profilesById.get(c.user_id)?.full_name ?? null,
      owner_email: profilesById.get(c.user_id)?.email ?? null,
      is_mine: c.user_id === userId,
    }));
  });

export const getCv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS already allows owner, tenant admin, or superadmin.
    const { data: cv } = await supabase
      .from("cv_logs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!cv) throw new Error("Not found");
    return cv;
  });

export const deleteCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // owner can delete via RLS; admins use service role check via rpc
    const { data: cv } = await supabase.from("cv_logs").select("user_id,tenant_id").eq("id", data.id).maybeSingle();
    if (!cv) throw new Error("Not found");
    if (cv.user_id === userId) {
      await supabase.from("cv_logs").delete().eq("id", data.id).eq("user_id", userId);
      return { ok: true };
    }
    // admin path — use service role after authorization
    const { data: isAdmin } = cv.tenant_id
      ? await supabase.rpc("is_tenant_admin", { _user_id: userId, _tenant_id: cv.tenant_id })
      : { data: false };
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: userId });

    if (!isAdmin && !isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("cv_logs").delete().eq("id", data.id);
    return { ok: true };
  });


export const updateCvStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        template: z.string().min(1).max(60).optional(),
        accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        print_locale: z.enum(["ar", "en"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { template?: string; accent_color?: string; print_locale?: string } = {};
    if (data.template) patch.template = data.template;
    if (data.accent_color) patch.accent_color = data.accent_color;
    if (data.print_locale) patch.print_locale = data.print_locale;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("cv_logs")
      .update(patch as any)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const translateCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      target: z.enum(["ar", "en"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const { data: cv } = await supabase
      .from("cv_logs").select("output,analysis,input")
      .eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (!cv) throw new Error("Not found");

    const langName = data.target === "ar" ? "Arabic (Egyptian/MSA)" : "English";
    const payload = { output: (cv as any).output, analysis: (cv as any).analysis };
    const gateway = createLovableAiGatewayProvider(apiKey);

    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      maxOutputTokens: 8192,
      system: `You translate CV JSON into ${langName}. Output ONLY one JSON object with the SAME shape and keys as the input. Translate every human-readable string value (summary, competencies, role, company, dates labels, bullets, achievements, category, skills, recommendations, strengths, weaknesses, question, hint, improvementPlan, reason). DO NOT translate URLs, brand names (LinkedIn, Wuzzuf, Bayt, Forasna, Indeed), proper nouns of people/companies, or numeric values. Keep array lengths and structure identical.`,
      prompt: JSON.stringify(payload),
    });
    const parsed = extractJsonObject(result.text);
    return {
      output: parsed?.output ?? payload.output,
      analysis: parsed?.analysis ?? payload.analysis,
    };
  });
