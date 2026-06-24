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
    return data ?? { tenant_id: prof.tenant_id, vodafone_number: "", instructions: "", credits_per_egp: 0.02 };
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
    const rate = Number((w as any)?.credits_per_egp ?? 0.02);
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
      .from("topup_requests")
      .select("*, payment_method:payment_methods(id,type,label,account_number)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(100);
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
    await context.supabase.rpc("log_audit" as any, {
      _action: data.approve ? "payment.topup_approved" : "payment.topup_rejected",
      _status: error ? "failure" : "success",
      _target: data.request_id,
      _link: "/admin/wallet",
      _metadata: { note: data.note || null, error: error ? String(error.message ?? error) : null } as any,
    });
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

// ============ Payment methods (multi-channel) ============

export const listPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tenantId = prof?.tenant_id ?? null;
    // Include tenant-specific methods + platform-wide (tenant_id IS NULL) methods
    const query = supabase
      .from("payment_methods" as any).select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const { data } = tenantId
      ? await query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      : await query.is("tenant_id", null);
    return (data as any[]) ?? [];
  });

const paymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["vodafone_cash","orange_cash","etisalat_cash","we_pay","instapay","bank_transfer","fawry","meeza","other"]),
  label: z.string().min(1).max(80),
  account_number: z.string().min(3).max(80),
  account_name: z.string().max(120).optional().nullable(),
  bank_name: z.string().max(120).optional().nullable(),
  instructions: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const upsertPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentMethodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("NO_TENANT");
    const payload: any = { ...data, tenant_id: prof.tenant_id };
    const { error } = await supabase.from("payment_methods" as any).upsert(payload);
    if (error) throw error;
    return { ok: true };
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payment_methods" as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Updated topup to attach payment method
export const createTopupRequestV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount_egp: z.number().positive().max(1000000),
      reference_number: z.string().max(80).optional().default(""),
      screenshot_path: z.string().min(3),
      payment_method_id: z.string().uuid().optional().nullable(),
      requested_plan: z.enum(["pro", "business"]).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("NO_TENANT");
    const [{ data: w }, { data: tenant }] = await Promise.all([
      supabase.from("wallet_settings").select("credits_per_egp").eq("tenant_id", prof.tenant_id).maybeSingle(),
      supabase.from("tenants").select("plan_credits_pro,plan_credits_business").eq("id", prof.tenant_id).maybeSingle(),
    ]);
    const rate = Number((w as any)?.credits_per_egp ?? 0.02);
    const credits = data.requested_plan === "pro"
      ? Math.max(1, Number((tenant as any)?.plan_credits_pro ?? Math.floor(data.amount_egp * rate)))
      : data.requested_plan === "business"
        ? Math.max(1, Number((tenant as any)?.plan_credits_business ?? Math.floor(data.amount_egp * rate)))
        : Math.max(1, Math.floor(data.amount_egp * rate));
    const { error } = await supabase.from("topup_requests").insert({
      tenant_id: prof.tenant_id,
      user_id: userId,
      amount_egp: data.amount_egp,
      credits_requested: credits,
      reference_number: data.reference_number || null,
      screenshot_path: data.screenshot_path,
      payment_method_id: data.payment_method_id || null,
      requested_plan: data.requested_plan || null,
    } as any);
    await supabase.rpc("log_audit" as any, {
      _action: "payment.topup_requested",
      _status: error ? "failure" : "success",
      _target: `${data.amount_egp} EGP → ${credits} credits`,
      _link: "/billing/topup",
      _metadata: { amount_egp: data.amount_egp, credits, error: error ? String(error.message ?? error) : null } as any,
    });
    if (error) throw error;
    return { ok: true, credits };
  });

