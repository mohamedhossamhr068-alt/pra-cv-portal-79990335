import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getWalletSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return null;
    const { data } = await supabase
      .from("wallet_settings").select("*").eq("tenant_id", prof.tenant_id).maybeSingle();
    return data ?? { tenant_id: prof.tenant_id, vodafone_number: "", instructions: "", credits_per_egp: 1 };
  });

export const updateWalletSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      vodafone_number: z.string().max(40),
      instructions: z.string().max(500).optional().default(""),
      credits_per_egp: z.number().min(0.01).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("NO_TENANT");
    const { error } = await supabase.from("wallet_settings").upsert({
      tenant_id: prof.tenant_id,
      vodafone_number: data.vodafone_number,
      instructions: data.instructions ?? "",
      credits_per_egp: data.credits_per_egp,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });

export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount_egp: z.number().positive().max(1000000),
      reference_number: z.string().max(80).optional().default(""),
      screenshot_path: z.string().min(3),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("NO_TENANT");
    const { data: w } = await supabase
      .from("wallet_settings").select("credits_per_egp").eq("tenant_id", prof.tenant_id).maybeSingle();
    const rate = Number((w as any)?.credits_per_egp ?? 1);
    const credits = Math.max(1, Math.floor(data.amount_egp * rate));
    const { error } = await supabase.from("topup_requests").insert({
      tenant_id: prof.tenant_id,
      user_id: userId,
      amount_egp: data.amount_egp,
      credits_requested: credits,
      reference_number: data.reference_number || null,
      screenshot_path: data.screenshot_path,
    });
    if (error) throw error;
    return { ok: true, credits };
  });

export const listMyTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("topup_requests").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });

export const listTenantTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data } = await supabase
      .from("topup_requests").select("*").eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false }).limit(200);
    if (!data) return [];
    // Fetch user names
    const ids = Array.from(new Set(data.map((r: any) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles").select("id,full_name,email").in("id", ids);
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return data.map((r: any) => ({ ...r, user: byId.get(r.user_id) ?? null }));
  });

export const reviewTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      request_id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().max(300).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_review_topup", {
      _request_id: data.request_id,
      _approve: data.approve,
      _note: data.note || null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });

export const getScreenshotUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("topup-screenshots").createSignedUrl(data.path, 600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
