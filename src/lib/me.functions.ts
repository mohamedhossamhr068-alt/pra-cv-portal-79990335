import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role,tenant_id").eq("user_id", userId),
    ]);
    let tenant = null as any;
    let subscription = null as any;
    if (profile?.tenant_id) {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", profile.tenant_id).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("tenant_id", profile.tenant_id).maybeSingle(),
      ]);
      tenant = t;
      subscription = s;
    }
    const monthKey = new Date().toISOString().slice(0, 7);
    const { data: quota } = await supabase
      .from("usage_quotas")
      .select("*")
      .eq("user_id", userId)
      .eq("period_month", monthKey)
      .maybeSingle();

    const planLimits: Record<string, number> = { free: 3, pro: 50, business: 9999 };
    const plan = subscription?.plan ?? "free";
    const limit = planLimits[plan] ?? 3;
    const used = quota?.cv_generations_used ?? 0;

    return {
      profile,
      tenant,
      subscription,
      roles: (roles ?? []).map((r) => r.role as string),
      quota: { used, limit, remaining: Math.max(0, limit - used), month: monthKey },
    };
  });
