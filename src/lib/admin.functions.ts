import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const listTenantUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tenantId = prof?.tenant_id ?? null;
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: userId });
    let isAdmin = false;
    if (tenantId) {
      const { data: a } = await supabase.rpc("is_tenant_admin", { _user_id: userId, _tenant_id: tenantId });
      isAdmin = !!a;
    }
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    // Superadmin sees every signup on the platform; tenant admin only their workspace.
    let usersQuery = supabase
      .from("profiles")
      .select("id,email,full_name,credits,is_blocked,created_at,grant_budget,grant_used,grant_period,grant_period_start,feature_flags,tenant_id")
      .order("created_at", { ascending: false });
    let rolesQuery = supabase.from("user_roles").select("user_id,role,tenant_id");
    let permsQuery = supabase.from("user_permissions" as any).select("user_id,permission,tenant_id");
    if (!isSuper && tenantId) {
      usersQuery = usersQuery.eq("tenant_id", tenantId);
      rolesQuery = rolesQuery.eq("tenant_id", tenantId);
      permsQuery = permsQuery.eq("tenant_id", tenantId);
    }
    const [{ data: users }, { data: roles }, { data: perms }] = await Promise.all([
      usersQuery,
      rolesQuery,
      permsQuery,
    ]);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
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

    // Tenant names for superadmin's cross-tenant view
    const tenantIds = Array.from(new Set((users ?? []).map((u: any) => u.tenant_id).filter(Boolean)));
    let tenantsById = new Map<string, string>();
    if (isSuper && tenantIds.length) {
      const { data: ts } = await supabase.from("tenants").select("id,name").in("id", tenantIds);
      tenantsById = new Map((ts ?? []).map((t: any) => [t.id, t.name]));
    }

    return (users ?? []).map((u: any) => ({
      ...u,
      roles: rolesByUser.get(u.id) ?? [],
      permissions: permsByUser.get(u.id) ?? [],
      tenant_name: u.tenant_id ? tenantsById.get(u.tenant_id) ?? null : null,
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
      period: z.enum(["monthly", "total"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_moderator_budget" as any, {
      _target_user: data.target_user,
      _budget: data.budget,
      _reset_used: data.reset_used ?? false,
      _period: data.period ?? null,
    } as any);
    if (error) throw error;
    await context.supabase.rpc("log_audit" as any, {
      _action: "admin.budget_updated",
      _status: "success",
      _target: data.target_user,
      _link: "/admin/users",
      _metadata: { budget: data.budget, reset_used: data.reset_used ?? false, period: data.period ?? null } as any,
    });
    return { ok: true };
  });

export const setUserFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      target_user: z.string().uuid(),
      flags: z.record(z.string(), z.boolean()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_user_feature_flags" as any, {
      _target_user: data.target_user,
      _flags: data.flags as any,
    } as any);
    if (error) throw error;
    await context.supabase.rpc("log_audit" as any, {
      _action: "admin.feature_flags_updated",
      _status: "success",
      _target: data.target_user,
      _link: "/admin/access",
      _metadata: { flags: data.flags } as any,
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
      currency: "EGP",
      plan_price_free: 0, plan_price_pro: 499, plan_price_business: 1499,
      plan_credits_free: 10, plan_credits_pro: 100, plan_credits_business: 500,
      bonus_credits: 3,
    }
  );
});


