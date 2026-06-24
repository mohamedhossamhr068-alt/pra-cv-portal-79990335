import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, pickBotSystem } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

async function callBot(history: { role: "user" | "assistant"; content: string }[], lang?: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.content;
  const system = pickBotSystem(lang, lastUser);
  const { text } = await generateText({
    model: gateway(MODEL),
    system,
    messages: history.slice(-12),
  });
  return text;
}

export const triggerSupportBotReply = createServerFn({ method: "POST" })
  .inputValidator((d: { conversation_id: string; lang?: string }) =>
    z.object({ conversation_id: z.string().uuid(), lang: z.string().max(8).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("conversations" as any)
      .select("id, kind, bot_enabled, human_replied, owner_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) return { ok: false, reason: "not_found" };
    const c = conv as any;
    if (c.kind !== "support" || !c.bot_enabled || c.human_replied) {
      return { ok: false, reason: "disabled" };
    }
    const { data: msgs } = await supabaseAdmin
      .from("conversation_messages" as any)
      .select("body, kind, sender_id")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = ((msgs ?? []) as any[])
      .filter((m) => m.body && m.kind !== "system")
      .map((m) => ({
        role: m.sender_id === c.owner_id ? ("user" as const) : ("assistant" as const),
        content: m.body as string,
      }));
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return { ok: false, reason: "no_user_msg" };
    }
    let reply: string;
    try {
      reply = await callBot(history, data.lang);
    } catch (e: any) {
      console.error("bot error", e?.message);
      return { ok: false, reason: "ai_error" };
    }
    await supabaseAdmin.rpc("chat_insert_bot_reply" as any, {
      _conversation_id: c.id,
      _body: reply,
      _is_guest: false,
    });
    return { ok: true };
  });
