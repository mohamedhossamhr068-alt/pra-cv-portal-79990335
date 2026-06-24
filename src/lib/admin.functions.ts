import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const listTenantUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId,
      _tenant_id: prof.tenant_id,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: users } = await supabase
      .from("profiles")
      .select("id,email,full_name,credits,is_blocked,created_at,grant_budget,grant_used")
      .eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id,role")
      .eq("tenant_id", prof.tenant_id);

    const { data: perms } = await supabase
      .from("user_permissions" as any)
      .select("user_id,permission")
      .eq("tenant_id", prof.tenant_id);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesByUser.set(r.user_id, list);
    });

    const permsByUser = new Map<string, string[]>();
    ((perms as any[]) ?? []).forEach((p) => {
      const list = permsByUser.get(p.user_id) ?? [];
      list.push(p.permission as string);
      permsByUser.set(p.user_id, list);
    });

    return (users ?? []).map((u) => ({
      ...u,
      roles: rolesByUser.get(u.id) ?? [],
      permissions: permsByUser.get(u.id) ?? [],
    }));
  });

const PermissionEnum = z.enum(["manage_users", "review_topups", "manage_offers", "view_audit", "view_usage"]);

export const setUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      target_user: z.string().uuid(),
      permissions: z.array(PermissionEnum).max(20),
      make_moderator: z.boolean().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_user_permissions" as any, {
      _target_user: data.target_user,
      _permissions: data.permissions,
      _make_moderator: data.make_moderator ?? null,
    } as any);
    if (error) throw error;
    await context.supabase.rpc("log_audit" as any, {
      _action: "admin.permissions_updated",
      _status: "success",
      _target: data.target_user,
      _link: "/admin/users",
      _metadata: { permissions: data.permissions, make_moderator: data.make_moderator } as any,
    });
    return { ok: true };
  });


export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        target_user: z.string().uuid(),
        credits: z.number().int().min(0).max(100000).optional(),
        is_blocked: z.boolean().optional(),
        grant_admin: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_update_user", {
      _target_user: data.target_user,
      _credits: data.credits ?? null,
      _is_blocked: data.is_blocked ?? null,
      _grant_admin: data.grant_admin ?? null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });

export const setModeratorBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      target_user: z.string().uuid(),
      budget: z.number().int().min(0).max(1000000).nullable(),
      reset_used: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_moderator_budget" as any, {
      _target_user: data.target_user,
      _budget: data.budget,
      _reset_used: data.reset_used ?? false,
    } as any);
    if (error) throw error;
    await context.supabase.rpc("log_audit" as any, {
      _action: "admin.budget_updated",
      _status: "success",
      _target: data.target_user,
      _link: "/admin/users",
      _metadata: { budget: data.budget, reset_used: data.reset_used ?? false } as any,
    });
    return { ok: true };
  });

export const getTenantPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return null;
    const { data } = await supabase
      .from("tenants")
      .select("cv_credit_cost,match_credit_cost,scrape_credit_cost,currency,plan_price_free,plan_price_pro,plan_price_business,plan_credits_free,plan_credits_pro,plan_credits_business,bonus_credits")
      .eq("id", prof.tenant_id)
      .maybeSingle();
    return data;
  });

const CURRENCIES = ["USD", "EGP", "SAR", "AED", "EUR", "GBP", "KWD", "QAR"] as const;

export const updateTenantPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cv_cost: z.number().int().min(0).max(1000).optional(),
        match_cost: z.number().int().min(0).max(1000).optional(),
        scrape_cost: z.number().int().min(0).max(1000).optional(),
        currency: z.enum(CURRENCIES).optional(),
        plan_free: z.number().min(0).max(100000).optional(),
        plan_pro: z.number().min(0).max(100000).optional(),
        plan_business: z.number().min(0).max(100000).optional(),
        credits_free: z.number().int().min(0).max(1000000).optional(),
        credits_pro: z.number().int().min(0).max(1000000).optional(),
        credits_business: z.number().int().min(0).max(1000000).optional(),
        bonus_credits: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_update_pricing", {
      _cv_cost: data.cv_cost ?? null,
      _match_cost: data.match_cost ?? null,
      _scrape_cost: data.scrape_cost ?? null,
      _currency: data.currency ?? null,
      _plan_free: data.plan_free ?? null,
      _plan_pro: data.plan_pro ?? null,
      _plan_business: data.plan_business ?? null,
      _credits_free: data.credits_free ?? null,
      _credits_pro: data.credits_pro ?? null,
      _credits_business: data.credits_business ?? null,
      _bonus_credits: data.bonus_credits ?? null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });

export const getPlatformPricing = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb
    .from("platform_pricing")
    .select("currency,plan_price_free,plan_price_pro,plan_price_business,plan_credits_free,plan_credits_pro,plan_credits_business,bonus_credits")
    .eq("id", "global")
    .maybeSingle();
  return (
    data ?? {
      currency: "USD",
      plan_price_free: 0, plan_price_pro: 29, plan_price_business: 99,
      plan_credits_free: 10, plan_credits_pro: 100, plan_credits_business: 500,
      bonus_credits: 3,
    }
  );
});

