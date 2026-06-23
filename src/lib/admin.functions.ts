import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
      .select("id,email,full_name,credits,is_blocked,created_at")
      .eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id,role")
      .eq("tenant_id", prof.tenant_id);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesByUser.set(r.user_id, list);
    });

    return (users ?? []).map((u) => ({ ...u, roles: rolesByUser.get(u.id) ?? [] }));
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

export const getTenantPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return null;
    const { data } = await supabase
      .from("tenants")
      .select("cv_credit_cost,match_credit_cost,scrape_credit_cost")
      .eq("id", prof.tenant_id)
      .maybeSingle();
    return data;
  });

export const updateTenantPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cv_cost: z.number().int().min(0).max(1000).optional(),
        match_cost: z.number().int().min(0).max(1000).optional(),
        scrape_cost: z.number().int().min(0).max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_update_pricing", {
      _cv_cost: data.cv_cost ?? null,
      _match_cost: data.match_cost ?? null,
      _scrape_cost: data.scrape_cost ?? null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });
