import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const must = (ok: boolean) => {
  if (!ok) throw new Error("Forbidden");
};

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId,
      _tenant_id: prof.tenant_id,
    });
    must(!!isAdmin);
    const { data } = await supabase
      .from("profiles")
      .select("id,email,full_name,created_at")
      .eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const updateBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120).optional(),
        logo_url: z.string().url().max(500).optional().or(z.literal("")),
        primary_color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("No tenant");
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId,
      _tenant_id: prof.tenant_id,
    });
    must(!!isAdmin);
    const patch: { name?: string; logo_url?: string | null; primary_color?: string } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url || null;
    if (data.primary_color !== undefined) patch.primary_color = data.primary_color;
    const { error } = await supabase.from("tenants").update(patch).eq("id", prof.tenant_id);
    if (error) throw error;
    return { ok: true };
  });

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("No tenant");
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId,
      _tenant_id: prof.tenant_id,
    });
    must(!!isAdmin);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { company_name: "__INVITED__", tenant_id_assign: prof.tenant_id },
    });
    if (error) throw new Error(error.message);

    if (invite?.user) {
      // Re-bind invited user to inviting tenant (override default trigger behavior)
      await supabaseAdmin.from("profiles").update({ tenant_id: prof.tenant_id }).eq("id", invite.user.id);
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", invite.user.id)
        .neq("tenant_id", prof.tenant_id);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: invite.user.id, tenant_id: prof.tenant_id, role: "user" }, { onConflict: "user_id,tenant_id,role" });
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      tenant_id: prof.tenant_id,
      action: "invite_user",
      target: data.email,
    });
    return { ok: true };
  });

export const updateLocale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ locale: z.enum(["en", "ar"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({ locale: data.locale }).eq("id", context.userId);
    return { ok: true };
  });

export const updateProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ full_name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({ full_name: data.full_name }).eq("id", context.userId);
    return { ok: true };
  });
