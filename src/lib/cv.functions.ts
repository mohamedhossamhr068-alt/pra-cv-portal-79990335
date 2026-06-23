import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CvOutputSchema = z.object({
  summary: z.string(),
  competencies: z.array(z.string()).min(4).max(12),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        dates: z.string(),
        bullets: z.array(z.string()).min(2).max(6),
      }),
    )
    .min(1)
    .max(8),
  achievements: z.array(z.string()).min(2).max(8),
  skillsMatrix: z
    .array(z.object({ category: z.string(), skills: z.array(z.string()).min(1) }))
    .min(2),
  recommendations: z.array(z.string()).min(2).max(6),
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

    let result;
    try {
      result = await generateObject({
        model: gateway("google/gemini-3-flash-preview"),
        schema: CvOutputSchema,
        system: `You are a senior HR writer producing ATS-optimized CVs. Strict rules:
- Do NOT invent companies, dates, titles, or achievements the candidate did not provide.
- Rewrite, structure, and quantify only what is implied by the user's inputs.
- When numbers are not provided, write qualitative bullets — never fake metrics.
- Use action verbs, concise lines, no first person, no clichés.
- ${langInstr}`,
        prompt: `Candidate: ${data.fullName}
Target role: ${data.jobTitle}
Industry: ${data.industry}
Seniority: ${data.seniority}
Skills (raw): ${data.skills}
Experience (raw): ${data.experience}

Produce an ATS-optimized CV broken into the schema fields.`,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("AI rate limit reached. Please try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted on this workspace.");
      throw new Error("AI generation failed: " + msg.slice(0, 200));
    }

    const cvOutput = result.object;

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
