import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getOrCreateMyConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "support" | "credit" }) =>
    z.object({ kind: z.enum(["support", "credit"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("chat_get_or_create_my_conversation" as any, {
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return id as unknown as string;
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "support" | "credit" }) =>
    z.object({ kind: z.enum(["support", "credit"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: convs, error } = await supabase
      .from("conversations" as any)
      .select("id, owner_id, kind, title, last_message_at, created_at, tenant_id")
      .eq("kind", data.kind)
      .order("last_message_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (convs ?? []) as any[];
    const ownerIds = Array.from(new Set(list.map((c) => c.owner_id)));
    if (ownerIds.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return list.map((c) => ({
      ...c,
      owner: byId.get(c.owner_id) ?? null,
    }));
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string }) =>
    z.object({ conversation_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("conversation_messages" as any)
      .select("id, conversation_id, sender_id, body, kind, credit_amount, credit_status, reviewed_by, reviewed_at, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = (msgs ?? []) as any[];
    const senderIds = Array.from(new Set(list.map((m) => m.sender_id)));
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", senderIds)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return list.map((m) => ({ ...m, sender: byId.get(m.sender_id) ?? null }));
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    conversation_id: string;
    body?: string;
    kind?: "text" | "credit_request";
    credit_amount?: number;
  }) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        body: z.string().max(4000).optional(),
        kind: z.enum(["text", "credit_request"]).optional(),
        credit_amount: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("chat_send_message" as any, {
      _conversation_id: data.conversation_id,
      _body: data.body ?? "",
      _kind: data.kind ?? "text",
      _credit_amount: data.credit_amount ?? null,
    });
    if (error) throw new Error(error.message);
    return id as unknown as string;
  });

export const reviewCreditRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string; approve: boolean; note?: string }) =>
    z
      .object({
        message_id: z.string().uuid(),
        approve: z.boolean(),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("chat_review_credit_request" as any, {
      _message_id: data.message_id,
      _approve: data.approve,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
