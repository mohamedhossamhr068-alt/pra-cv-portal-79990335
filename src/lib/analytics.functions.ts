import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTenantAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return { byDay: [], byTemplate: [], totalUsers: 0, totalCvs: 0 };
    const tid = prof.tenant_id;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [{ data: cvs }, { data: members }] = await Promise.all([
      supabase
        .from("cv_logs")
        .select("created_at,template,user_id")
        .eq("tenant_id", tid)
        .gte("created_at", since.toISOString()),
      supabase.from("profiles").select("id").eq("tenant_id", tid),
    ]);

    const dayMap = new Map<string, number>();
    const tplMap = new Map<string, number>();
    (cvs ?? []).forEach((c) => {
      const d = (c.created_at as string).slice(0, 10);
      dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
      tplMap.set(c.template, (tplMap.get(c.template) ?? 0) + 1);
    });
    const byDay = Array.from(dayMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
    const byTemplate = Array.from(tplMap.entries()).map(([template, count]) => ({ template, count }));

    return {
      byDay,
      byTemplate,
      totalUsers: members?.length ?? 0,
      totalCvs: cvs?.length ?? 0,
    };
  });

export const getPlatformAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [tenants, users, cvs, subs] = await Promise.all([
      supabaseAdmin.from("tenants").select("id,name,industry,created_at"),
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("cv_logs").select("created_at"),
      supabaseAdmin.from("subscriptions").select("plan,status"),
    ]);
    const prices: Record<string, number> = { free: 0, pro: 29, business: 99 };
    const mrr = (subs.data ?? [])
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + (prices[s.plan as string] ?? 0), 0);
    return {
      tenants: tenants.data ?? [],
      tenantCount: tenants.data?.length ?? 0,
      userCount: users.data?.length ?? 0,
      cvCount: cvs.data?.length ?? 0,
      mrr,
    };
  });
