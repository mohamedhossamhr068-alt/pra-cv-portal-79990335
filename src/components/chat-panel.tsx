import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Send, Check, X, Coins, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { listMessages, sendChatMessage, reviewCreditRequest } from "@/lib/chat.functions";
import { triggerSupportBotReply } from "@/lib/bot.functions";
import { setBotEnabled } from "@/lib/guest-chat.functions";
import { fmtCairo } from "@/lib/time";
import { useMeQuery } from "@/lib/me.hooks";
import { toast } from "sonner";

type Props = {
  conversationId: string;
  kind: "support" | "credit";
  /** show credit request composer (moderators on their own credit conv) */
  showCreditRequest?: boolean;
  /** show approve/reject buttons (admins) */
  canReview?: boolean;
  /** owner-side: trigger bot reply after sending */
  triggerBot?: boolean;
  /** staff-side: show bot on/off toggle */
  showBotToggle?: boolean;
  /** initial bot state for the toggle */
  initialBotEnabled?: boolean;
};

export function ChatPanel({ conversationId, kind, showCreditRequest, canReview, triggerBot, showBotToggle, initialBotEnabled }: Props) {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const me = useMeQuery();
  const qc = useQueryClient();
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendChatMessage);
  const reviewFn = useServerFn(reviewCreditRequest);
  const botFn = useServerFn(triggerSupportBotReply);
  const toggleBotFn = useServerFn(setBotEnabled);
  const [botOn, setBotOn] = useState<boolean>(initialBotEnabled ?? true);
  useEffect(() => {
    if (typeof initialBotEnabled === "boolean") setBotOn(initialBotEnabled);
  }, [initialBotEnabled]);

  const q = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => listFn({ data: { conversation_id: conversationId } }),
    refetchInterval: 8000,
  });

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [q.data?.length]);

  const [text, setText] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendFn({ data: { conversation_id: conversationId, body: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      if (triggerBot && kind === "support") {
        botFn({ data: { conversation_id: conversationId } }).catch(() => {});
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  const onToggleBot = async (next: boolean) => {
    setBotOn(next);
    try {
      await toggleBotFn({ data: { conversation_id: conversationId, enabled: next } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
      setBotOn(!next);
    }
  };

  const sendCreditRequest = async () => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0) {
      toast.error(ar ? "أدخل عدد كرديت صالح" : "Enter a valid amount");
      return;
    }
    setSending(true);
    try {
      await sendFn({
        data: {
          conversation_id: conversationId,
          body: text.trim() || undefined,
          kind: "credit_request",
          credit_amount: n,
        },
      });
      setText("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  const review = async (id: string, approve: boolean) => {
    try {
      await reviewFn({ data: { message_id: id, approve } });
      qc.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(approve ? (ar ? "تمت الموافقة" : "Approved") : (ar ? "تم الرفض" : "Rejected"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const meId = me.data?.profile?.id;

  return (
    <Card className="flex h-[70vh] flex-col overflow-hidden">
      {showBotToggle && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-primary" />
            <span className="font-medium">{ar ? "البوت الذكي" : "AI bot"}</span>
            <span className="text-xs text-muted-foreground">
              {botOn ? (ar ? "يرد تلقائياً حتى يتدخل المشرف" : "Auto-replies until staff steps in") : (ar ? "متوقف" : "Off")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bot-toggle" className="text-xs">{ar ? "تفعيل" : "Enable"}</Label>
            <Switch id="bot-toggle" checked={botOn} onCheckedChange={onToggleBot} />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
        {q.isLoading && <div className="text-sm text-muted-foreground">{ar ? "جار التحميل…" : "Loading…"}</div>}
        {q.data?.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            {ar ? "لا توجد رسائل بعد." : "No messages yet."}
          </div>
        )}
        {q.data?.map((m: any) => {
          const mine = m.sender_id === meId;
          const isSystem = m.kind === "system";
          const isBot = m.kind === "bot";
          if (isSystem) {
            return (
              <div key={m.id} className="text-center">
                <span className="inline-block rounded-full bg-background border px-3 py-1 text-xs text-muted-foreground">
                  {m.body}
                </span>
              </div>
            );
          }
          const isCredit = m.kind === "credit_request";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : isBot
                      ? "bg-primary/5 border border-primary/30"
                      : "bg-background border"
                }`}
              >
                <div className="text-[11px] opacity-70 mb-0.5 flex items-center gap-1">
                  {isBot && <Bot className="h-3 w-3" />}
                  {isBot ? (ar ? "مساعد PRA الذكي" : "PRA AI") : (m.sender?.full_name ?? m.sender?.email ?? "—")}
                </div>
                {isCredit ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <Coins className="h-4 w-4" />
                      {ar ? "طلب زيادة كرديت" : "Credit request"}: {m.credit_amount}
                    </div>
                    {m.body && <div className="text-sm whitespace-pre-wrap">{m.body}</div>}
                    <div>
                      <Badge
                        variant={
                          m.credit_status === "approved"
                            ? "default"
                            : m.credit_status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {m.credit_status === "approved"
                          ? ar
                            ? "تمت الموافقة"
                            : "Approved"
                          : m.credit_status === "rejected"
                            ? ar
                              ? "مرفوض"
                              : "Rejected"
                            : ar
                              ? "قيد المراجعة"
                              : "Pending"}
                      </Badge>
                    </div>
                    {canReview && m.credit_status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="secondary" onClick={() => review(m.id, true)}>
                          <Check className="h-3 w-3 me-1" />
                          {ar ? "موافقة" : "Approve"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => review(m.id, false)}>
                          <X className="h-3 w-3 me-1" />
                          {ar ? "رفض" : "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                )}
                <div className="text-[10px] opacity-60 mt-1">
                  {fmtCairo(m.created_at, ar)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-background p-3 space-y-2">
        {showCreditRequest && (
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder={ar ? "عدد الكرديت المطلوب" : "Credits requested"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40"
            />
            <Button onClick={sendCreditRequest} disabled={sending} variant="secondary">
              <Coins className="h-4 w-4 me-2" />
              {ar ? "إرسال طلب كرديت" : "Request credits"}
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ar ? "اكتب رسالتك… (Enter للإرسال)" : "Type a message… (Enter to send)"}
            rows={2}
            className="min-h-[44px]"
          />
          <Button onClick={send} disabled={sending || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
