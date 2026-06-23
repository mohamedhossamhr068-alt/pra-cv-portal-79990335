import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getMatchCost(supabase: any, userId: string): Promise<number> {
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  if (!prof?.tenant_id) return 1;
  const { data: t } = await supabase.from("tenants").select("match_credit_cost").eq("id", prof.tenant_id).maybeSingle();
  return (t as any)?.match_credit_cost ?? 1;
}

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("job_listings")
      .select("*")
      .eq("country", "EG")
      .order("posted_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const runMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits,is_blocked")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_blocked) throw new Error("ACCOUNT_BLOCKED");
    const MATCH_CREDIT_COST = await getMatchCost(supabase, userId);
    if ((profile?.credits ?? 0) < MATCH_CREDIT_COST) throw new Error("NO_CREDITS");

    const { data: cvs } = await supabase
      .from("cv_logs")
      .select("output")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!cvs || cvs.length === 0) throw new Error("NO_CV");

    const out: any = cvs[0].output;
    const userSkills = new Set<string>(
      (out?.skillsMatrix ?? []).flatMap((g: any) => g.skills ?? []).map((s: string) => s.toLowerCase()),
    );

    const { data: jobs } = await supabase.from("job_listings").select("*").eq("country", "EG").limit(200);
    const titleTokens = new Set<string>(
      String(((out as any)?.experience?.[0]?.role ?? "") + " " + ((out as any)?.summary ?? ""))
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2),
    );
    const scored = (jobs ?? []).map((job) => {
      const skills: string[] = job.skills ?? [];
      const overlap = skills.filter((s) => userSkills.has(s.toLowerCase())).length;
      const titleHit = String(job.title ?? "")
        .toLowerCase()
        .split(/\s+/)
        .some((t) => titleTokens.has(t))
        ? 15
        : 0;
      const skillScore = skills.length ? Math.round((overlap / skills.length) * 100) : 0;
      const score = Math.min(99, skillScore + titleHit);
      return {
        job_id: job.id,
        score,
        reasoning: `${overlap} of ${skills.length} required skills overlap${titleHit ? " · role title match" : ""}.`,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 20);

    if (top.length > 0) {
      await supabase.from("job_matches").delete().eq("user_id", userId);
      await supabase.from("job_matches").insert(
        top.map((t) => ({ user_id: userId, job_id: t.job_id, score: t.score, reasoning: t.reasoning })),
      );
    }
    // Deduct credits
    await supabase
      .from("profiles")
      .update({ credits: (profile?.credits ?? 0) - MATCH_CREDIT_COST })
      .eq("id", userId);
    return { matched: top.length };
  });


export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: matches } = await supabase
      .from("job_matches")
      .select("score,reasoning,job_id")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(20);
    if (!matches || matches.length === 0) return [] as any[];
    const ids = matches.map((m) => m.job_id);
    const { data: jobs } = await supabase.from("job_listings").select("*").in("id", ids);
    const byId = new Map((jobs ?? []).map((j) => [j.id, j] as const));
    return matches.map((m) => ({ ...m, job: byId.get(m.job_id) }));
  });
