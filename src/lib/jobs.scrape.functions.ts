import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Real-time Egypt job scraping via Firecrawl search API.
// Only company_admin or superadmin can trigger to avoid abuse / cost.

const QUERIES = [
  { q: "site:linkedin.com/jobs Egypt", source: "linkedin" },
  { q: "site:wuzzuf.net jobs Egypt", source: "wuzzuf" },
  { q: "site:bayt.com Egypt jobs", source: "bayt" },
  { q: "site:forasna.com Egypt", source: "forasna" },
];

function logoFor(url: string, source: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `https://logo.clearbit.com/${host}`;
  } catch {
    return `https://logo.clearbit.com/${source}.com`;
  }
}

function guessCompany(title: string, url: string) {
  const m = title.match(/\bat\s+([A-Z][\w&. -]{2,})/);
  if (m) return m[1].trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return "Unknown";
  }
}

function extractSkills(text: string): string[] {
  const keywords = [
    "React","Node.js","Python","Java","TypeScript","JavaScript","SQL","AWS","Docker",
    "Kubernetes","Flutter","Swift","Kotlin","Figma","Photoshop","SEO","Marketing",
    "Sales","Excel","Power BI","Arabic","English","Agile","Scrum","REST","GraphQL",
    "Next.js","Vue","Angular","PHP","Laravel","Django","MongoDB","PostgreSQL",
  ];
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k.toLowerCase())).slice(0, 8);
}

export const scrapeEgyptJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ keyword: z.string().min(2).max(60).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Authorize: only admin/superadmin can trigger
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle(),
    ]);
    const allowed = (roles ?? []).some((r) => r.role === "company_admin" || r.role === "superadmin");
    if (!allowed) throw new Error("FORBIDDEN");

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not connected.");

    const kw = (data.keyword ?? "").trim();
    const queries = QUERIES.map((q) => ({ ...q, q: kw ? `${kw} ${q.q}` : q.q }));

    const collected: any[] = [];
    for (const { q, source } of queries) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ query: q, limit: 6, lang: "en", country: "eg" }),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const results = json?.data?.web ?? json?.data ?? [];
        for (const r of results) {
          if (!r?.url || !r?.title) continue;
          const desc = String(r.description ?? r.snippet ?? r.markdown ?? "");
          const company = guessCompany(String(r.title), String(r.url));
          collected.push({
            title: String(r.title).slice(0, 200),
            company,
            description: desc.slice(0, 500),
            external_url: String(r.url),
            source,
            company_logo: logoFor(String(r.url), source),
            skills: extractSkills(`${r.title} ${desc}`),
            seniority: /senior|lead|principal/i.test(r.title) ? "senior"
              : /junior|entry|intern/i.test(r.title) ? "junior"
              : "mid",
            location: "Egypt",
            country: "EG",
            employment_type: /remote/i.test(`${r.title} ${desc}`) ? "Remote" : "Full-time",
            industry: source,
            posted_at: new Date().toISOString(),
          });
        }
      } catch {
        // swallow per-query failures
      }
    }

    if (collected.length === 0) return { inserted: 0, skipped: 0, note: "No results from Firecrawl." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("job_listings")
      .upsert(collected, { onConflict: "external_url", ignoreDuplicates: false });
    if (error) throw error;

    return { inserted: collected.length, skipped: 0 };
  });
