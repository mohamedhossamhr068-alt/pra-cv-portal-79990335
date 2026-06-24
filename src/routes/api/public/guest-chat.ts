import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, BOT_SYSTEM_AR } from "@/lib/ai-gateway.server";

const Body = z.object({
  guest_token: z.string().min(8).max(80),
  message: z.string().min(1).max(2000),
  display_name: z.string().max(80).optional(),
  email: z.string().email().max(160).optional(),
});

export const Route = createFileRoute("/api/public/guest-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch (e: any) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // get or create guest conversation by token
        let conv: any;
        const { data: existing } = await supabaseAdmin
          .from("guest_conversations" as any)
          .select("id, bot_enabled, human_replied, tenant_id")
          .eq("guest_token", body.guest_token)
          .maybeSingle();
        if (existing) {
          conv = existing;
          if (body.display_name || body.email) {
            await supabaseAdmin
              .from("guest_conversations" as any)
              .update({
                display_name: body.display_name ?? undefined,
                email: body.email ?? undefined,
              })
              .eq("id", conv.id);
          }
        } else {
          const { data: created, error: cErr } = await supabaseAdmin
            .from("guest_conversations" as any)
            .insert({
              guest_token: body.guest_token,
              display_name: body.display_name,
              email: body.email,
            })
            .select("id, bot_enabled, human_replied, tenant_id")
            .single();
          if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500 });
          conv = created;
        }

        // insert the guest message
        await supabaseAdmin.from("guest_messages" as any).insert({
          conversation_id: conv.id,
          sender: "guest",
          body: body.message.trim(),
        });
        await supabaseAdmin
          .from("guest_conversations" as any)
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);

        // bot reply if enabled and no human has taken over
        let botReply: string | null = null;
        if (conv.bot_enabled && !conv.human_replied) {
          const key = process.env.LOVABLE_API_KEY;
          if (key) {
            try {
              const { data: history } = await supabaseAdmin
                .from("guest_messages" as any)
                .select("sender, body")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true })
                .limit(20);
              const messages = ((history ?? []) as any[]).map((m) => ({
                role: m.sender === "guest" ? ("user" as const) : ("assistant" as const),
                content: m.body as string,
              }));
              const gateway = createLovableAiGatewayProvider(key);
              const { text } = await generateText({
                model: gateway("google/gemini-3-flash-preview"),
                system: BOT_SYSTEM_AR,
                messages,
              });
              botReply = text;
              await supabaseAdmin.rpc("chat_insert_bot_reply" as any, {
                _conversation_id: conv.id,
                _body: text,
                _is_guest: true,
              });
            } catch (e: any) {
              console.error("guest bot error", e?.message);
            }
          }
        }

        return Response.json({
          ok: true,
          conversation_id: conv.id,
          bot_reply: botReply,
          human_takeover: conv.human_replied,
        });
      },
      // GET: fetch messages by token
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("guest_token");
        if (!token) return new Response("missing token", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conv } = await supabaseAdmin
          .from("guest_conversations" as any)
          .select("id, bot_enabled, human_replied")
          .eq("guest_token", token)
          .maybeSingle();
        if (!conv) return Response.json({ messages: [] });
        const { data: msgs } = await supabaseAdmin
          .from("guest_messages" as any)
          .select("id, sender, body, created_at")
          .eq("conversation_id", (conv as any).id)
          .order("created_at", { ascending: true });
        return Response.json({
          conversation_id: (conv as any).id,
          human_takeover: (conv as any).human_replied,
          messages: msgs ?? [],
        });
      },
    },
  },
});
