import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Mail, User as UserIcon } from "lucide-react";
import {
  listGuestConversations,
  listGuestMessages,
  sendGuestStaffReply,
  setBotEnabled,
} from "@/lib/guest-chat.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtCairo } from "@/lib/time";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/chat/guests")({
  component: AdminGuestsChat,
});

function AdminGuestsChat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const me = useMeQuery();
  const qc = useQueryClient();
  const listFn = useServerFn(listGuestConversations);
  const msgsFn = useServerFn(listGuestMessages);
  const sendFn = useServerFn(sendGuestStaffReply);
  const toggleFn = useServerFn(setBotEnabled);
  const allowed =
    me.data?.roles?.includes("company_admin") || me.data?.roles?.includes("moderator") || me.data?.roles?.includes("superadmin");

  const list = useQuery({
    queryKey: ["guest-conversations"],
    queryFn: () => listFn(),
    enabled: !!allowed,
    refetchInterval: 10000,
  });
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!active && list.data?.[0]) setActive(list.data[0].id);
  }, [list.data, active]);

  const msgs = useQuery({
    queryKey: ["guest-messages", active],
    queryFn: () => (active ? msgsFn({ data: { conversation_id: active } }) : Promise.resolve([])),
    enabled: !!active,
    refetchInterval: 5000,
  });

  // realtime
  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel(`guest-${active}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guest_messages", filter: `conversation_id=eq.${active}` },
        () => qc.invalidateQueries({ queryKey: ["guest-messages", active] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active, qc]);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs.data?.length]);

  const send = async () => {
    if (!active || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendFn({ data: { conversation_id: active, body: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["guest-messages", active] });
      qc.invalidateQueries({ queryKey: ["guest-conversations"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  const activeConv: any = list.data?.find((c: any) => c.id === active);

  const onToggle = async (next: boolean) => {
    if (!active) return;
    try {
      await toggleFn({ data: { conversation_id: active, enabled: next, is_guest: true } });
      qc.invalidateQueries({ queryKey: ["guest-conversations"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  if (!allowed) return <div className="text-sm text-muted-foreground">{ar ? "غير مصرح" : "Forbidden"}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? "محادثات الزوار" : "Visitor inbox"}</h1>
        <p className="text-sm text-muted-foreground">
          {ar ? "المحادثات اللي بدأها زوار من شات الموقع — البوت يرد تلقائياً لحد ما تتدخل." : "Conversations from the public chat widget. Bot replies until you take over."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {list.data?.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">{ar ? "لا توجد محادثات بعد." : "No conversations yet."}</div>
            )}
            {list.data?.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn("block w-full text-start p-3 hover:bg-muted/50", active === c.id && "bg-muted")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.display_name || (ar ? "زائر" : "Visitor")}</div>
                    {c.email && (
                      <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {c.bot_enabled && !c.human_replied ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]"><Bot className="h-3 w-3" />Bot</Badge>
                    ) : c.human_replied ? (
                      <Badge className="gap-1 text-[10px]"><UserIcon className="h-3 w-3" />{ar ? "بشري" : "Human"}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{fmtCairo(c.last_message_at, ar)}</div>
              </button>
            ))}
          </div>
        </Card>

        <div>
          {active && activeConv ? (
            <Card className="flex h-[70vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
                <div className="text-sm">
                  <span className="font-semibold">{activeConv.display_name || (ar ? "زائر" : "Visitor")}</span>
                  {activeConv.email && <span className="ms-2 text-xs text-muted-foreground">{activeConv.email}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="gbot" className="text-xs">{ar ? "البوت" : "Bot"}</Label>
                  <Switch id="gbot" checked={!!activeConv.bot_enabled} onCheckedChange={onToggle} />
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
                {msgs.data?.map((m: any) => {
                  const mine = m.sender === "staff";
                  const isBot = m.sender === "bot";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : isBot
                              ? "bg-primary/5 border border-primary/30"
                              : "bg-background border",
                        )}
                      >
                        <div className="mb-0.5 flex items-center gap-1 text-[11px] opacity-70">
                          {isBot ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                          {isBot ? (ar ? "مساعد PRA" : "PRA AI") : mine ? (ar ? "أنت" : "You") : (ar ? "الزائر" : "Visitor")}
                        </div>
                        {m.body}
                        <div className="mt-1 text-[10px] opacity-60">{fmtCairo(m.created_at, ar)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div className="flex items-end gap-2 border-t bg-background p-3">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder={ar ? "اكتب رد… (Enter للإرسال)" : "Reply… (Enter to send)"}
                  className="min-h-[44px]"
                />
                <Button onClick={send} disabled={sending || !text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">{ar ? "اختر محادثة" : "Select a conversation"}</Card>
          )}
        </div>
      </div>
    </div>
  );
}
