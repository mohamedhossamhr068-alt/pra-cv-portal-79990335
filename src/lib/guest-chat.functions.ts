import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Staff: list all guest conversations in their tenant (or unassigned). */
export const listGuestConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("guest_conversations" as any)
      .select("id, display_name, email, bot_enabled, human_replied, last_message_at, created_at, tenant_id")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Staff: list messages of a guest conversation. */
export const listGuestMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string }) =>
    z.object({ conversation_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("guest_messages" as any)
      .select("id, sender, sender_id, body, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []) as any[];
  });

/** Staff: send a reply to a guest conversation. */
export const sendGuestStaffReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string; body: string }) =>
    z.object({ conversation_id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("guest_messages" as any).insert({
      conversation_id: data.conversation_id,
      sender: "staff",
      sender_id: userId,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Staff: toggle bot for a conversation. */
export const setBotEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string; enabled: boolean; is_guest?: boolean }) =>
    z.object({
      conversation_id: z.string().uuid(),
      enabled: z.boolean(),
      is_guest: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("chat_set_bot_enabled" as any, {
      _conversation_id: data.conversation_id,
      _enabled: data.enabled,
      _is_guest: data.is_guest ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
