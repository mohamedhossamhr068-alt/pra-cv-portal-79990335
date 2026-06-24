import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Real-time Egypt job scraping via Firecrawl search API.
// Only company_admin or superadmin can trigger to avoid abuse / cost.

// Egypt-only sources. We always inject the keyword and `Egypt` to keep results local.
const SOURCES: { host: string; source: string }[] = [
  { host: "wuzzuf.net", source: "wuzzuf" },
  { host: "linkedin.com/jobs", source: "linkedin" },
  { host: "bayt.com", source: "bayt" },
  { host: "forasna.com", source: "forasna" },
  { host: "naukrigulf.com", source: "naukrigulf" },
];

function isSafeHttpUrl(u: string) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isEgyptUrl(u: string) {
  const s = u.toLowerCase();
  return /(\/eg\/|\/egypt|egypt|cairo|alexandria|giza|wuzzuf\.net)/.test(s);
}


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

    // Authorize: any authenticated user can trigger a narrow keyword search.
    // Bulk scraping (no keyword) is restricted to company_admin / superadmin.
    const hasKeyword = !!(data.keyword && data.keyword.trim().length >= 2);
    if (!hasKeyword) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const allowed = (roles ?? []).some((r) => r.role === "company_admin" || r.role === "superadmin");
      if (!allowed) throw new Error("FORBIDDEN");
    }

    // Half-credit pricing for keyword job searches: charge 1 credit per every 2 searches.
    // Bulk admin scrapes (no keyword) are not charged.
    if (hasKeyword) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits,is_blocked,job_search_count")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.is_blocked) throw new Error("ACCOUNT_BLOCKED");
      const nextCount = (profile?.job_search_count ?? 0) + 1;
      const shouldCharge = nextCount % 2 === 0; // every 2nd search costs 1 credit
      if (shouldCharge && (profile?.credits ?? 0) < 1) throw new Error("NO_CREDITS");
      await supabase
        .from("profiles")
        .update({
          job_search_count: nextCount,
          credits: shouldCharge ? (profile?.credits ?? 0) - 1 : (profile?.credits ?? 0),
        })
        .eq("id", userId);
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not connected.");


    let kw = (data.keyword ?? "").trim();
    // If no keyword passed, auto-derive from the user's latest CV (job title / role).
    if (!kw) {
      const { data: cvs } = await supabase
        .from("cv_logs").select("output").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1);
      const out: any = cvs?.[0]?.output;
      kw = String(
        out?.targetRole ?? out?.headline ?? out?.experience?.[0]?.role ?? out?.personalInfo?.title ?? "",
      ).trim().split("\n")[0].slice(0, 60);
    }
    if (!kw) kw = "jobs";

    const queries = SOURCES.map(({ host, source }) => ({
      source,
      q: `site:${host} "${kw}" Egypt`,
    }));

    const collected: any[] = [];
    for (const { q, source } of queries) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query: q, limit: 8, lang: "en", country: "eg", location: "Egypt" }),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const results = json?.data?.web ?? json?.data ?? [];
        for (const r of results) {
          if (!r?.url || !r?.title) continue;
          if (!isSafeHttpUrl(String(r.url))) continue;
          if (!isEgyptUrl(String(r.url))) continue; // hard Egypt filter

          const desc = String(r.description ?? r.snippet ?? r.markdown ?? "");
          // Drop obvious non-Egypt mentions
          if (/\b(saudi|riyadh|jeddah|dubai|abu dhabi|qatar|kuwait|oman|bahrain|usa|united states|uk|london)\b/i
              .test(`${r.title} ${desc}`)) continue;
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
