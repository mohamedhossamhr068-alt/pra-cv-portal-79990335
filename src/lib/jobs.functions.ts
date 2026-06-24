import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getMatchCost(supabase: any, userId: string): Promise<number> {
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  if (!prof?.tenant_id) return 1;
  const { data: t } = await supabase.from("tenants").select("match_credit_cost").eq("id", prof.tenant_id).maybeSingle();
  return (t as any)?.match_credit_cost ?? 1;
}

export const listJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ keyword: z.string().max(80).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("job_listings")
      .select("*")
      .eq("country", "EG")
      .order("posted_at", { ascending: false })
      .limit(100);
    const kw = (data.keyword ?? "").trim();
    if (kw.length >= 2) {
      // Match title OR skills OR company (case-insensitive)
      q = q.or(`title.ilike.%${kw}%,company.ilike.%${kw}%,description.ilike.%${kw}%`);
    }
    const { data: rows } = await q;
    return rows ?? [];
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
    (out?.competencies ?? []).forEach((c: string) => userSkills.add(String(c).toLowerCase()));

    const STOP = new Set(["the","a","an","of","and","or","for","to","in","at","on","with","by","is","as","sr","jr","senior","junior","mid","lead"]);
    const tokenize = (s: string) =>
      String(s ?? "")
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((t) => t.length > 1 && !STOP.has(t));

    const userRoles: string[] = [
      ...((out?.experience ?? []) as any[]).map((e) => e?.role ?? ""),
      out?.headline ?? "",
    ].filter(Boolean);
    const userRoleTokenSets = userRoles.map((r) => new Set(tokenize(r)));
    const userSummaryTokens = new Set<string>(tokenize(out?.summary ?? ""));

    const { data: jobs } = await supabase.from("job_listings").select("*").eq("country", "EG").limit(200);
    const scored = (jobs ?? []).map((job) => {
      const jobTitleTokens = tokenize(job.title ?? "");
      const jobTitleSet = new Set(jobTitleTokens);

      // Title similarity: best Jaccard across user roles
      let titleSim = 0;
      let bestRole = "";
      for (let i = 0; i < userRoleTokenSets.length; i++) {
        const rs = userRoleTokenSets[i];
        if (rs.size === 0 || jobTitleSet.size === 0) continue;
        let inter = 0;
        rs.forEach((t) => { if (jobTitleSet.has(t)) inter++; });
        const union = new Set([...rs, ...jobTitleSet]).size;
        const sim = inter / union;
        if (sim > titleSim) { titleSim = sim; bestRole = userRoles[i]; }
      }
      // Summary echo: small bonus when title words appear in summary
      let summaryHits = 0;
      jobTitleSet.forEach((t) => { if (userSummaryTokens.has(t)) summaryHits++; });
      const summaryBoost = Math.min(10, summaryHits * 3);

      // Title score: exact (sim=1) -> 70, strong overlap -> proportional
      const titleScore = Math.round(titleSim * 70);
      const sameTitle = titleSim >= 0.6;

      // Skills overlap up to 25 points
      const skills: string[] = job.skills ?? [];
      const overlap = skills.filter((s) => userSkills.has(s.toLowerCase())).length;
      const skillRatio = skills.length ? overlap / skills.length : 0;
      const skillScore = Math.round(skillRatio * 25);

      let score = titleScore + skillScore + summaryBoost;
      // Floor when CV exists and there's any title-word overlap
      if (titleSim > 0 && score < 35) score = 35;
      // Strong floor when titles essentially match
      if (sameTitle && score < 75) score = 75;
      score = Math.max(0, Math.min(99, score));

      const reasonParts: string[] = [];
      if (sameTitle) reasonParts.push(`role title matches your "${bestRole}"`);
      else if (titleSim > 0) reasonParts.push(`partial title overlap with "${bestRole}"`);
      if (skills.length) reasonParts.push(`${overlap}/${skills.length} required skills overlap`);
      if (summaryHits > 0) reasonParts.push(`summary mentions ${summaryHits} title term${summaryHits > 1 ? "s" : ""}`);
      return {
        job_id: job.id,
        score,
        reasoning: reasonParts.join(" · ") || "Limited signals to match.",
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
