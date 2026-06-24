import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ListSchema = z.object({
  type: z.enum(["all", "admin_action", "topup_approved", "topup_rejected", "offer_created", "cv_generated"]).optional().default("admin_action"),
  read: z.enum(["all", "unread", "read"]).optional().default("all"),
  since: z.enum(["all", "24h", "7d", "30d"]).optional().default("all"),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export const listAdminNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return { items: [], unread: 0 };
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId, _tenant_id: prof.tenant_id,
    });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("notifications")
      .select("id,type,title,body,link,metadata,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.type !== "all") q = q.eq("type", data.type);
    if (data.read === "unread") q = q.is("read_at", null);
    if (data.read === "read") q = q.not("read_at", "is", null);
    if (data.since !== "all") {
      const ms = data.since === "24h" ? 86400000 : data.since === "7d" ? 7 * 86400000 : 30 * 86400000;
      q = q.gte("created_at", new Date(Date.now() - ms).toISOString());
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const actorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.metadata?.actor_id).filter(Boolean) as string[])
    );
    let actors = new Map<string, { full_name: string | null; email: string | null }>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,email").in("id", actorIds);
      actors = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const items = (rows ?? []).map((r: any) => ({
      ...r,
      actor: r.metadata?.actor_id ? actors.get(r.metadata.actor_id) ?? null : null,
    }));

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    return { items, unread: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId);
    if (data.all) {
      q = q.is("read_at", null);
    } else if (data.ids && data.ids.length) {
      q = q.in("id", data.ids);
    } else {
      return { ok: true };
    }
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });
