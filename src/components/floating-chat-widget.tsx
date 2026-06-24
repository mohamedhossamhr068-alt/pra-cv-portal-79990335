import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type GuestMsg = { id: string; sender: "guest" | "bot" | "staff"; body: string; created_at: string };

const TOKEN_KEY = "pra_guest_chat_token";

function getOrCreateToken() {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = `g_${crypto.randomUUID()}`;
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function FloatingChatWidget() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthed(!!session);
      // Auto-open chat right after sign-in
      if (event === "SIGNED_IN" && !autoOpened) {
        setOpen(true);
        setAutoOpened(true);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [autoOpened]);

  if (authed === null) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-5 end-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 end-5 z-50 w-[min(92vw,380px)]">
          {authed ? <AuthedSupportChat ar={ar} onClose={() => setOpen(false)} /> : <GuestChat ar={ar} onClose={() => setOpen(false)} />}
        </div>
      )}
    </>
  );
}

// ------------------ Guest (visitor) chat ------------------
function GuestChat({ ar, onClose }: { ar: boolean; onClose: () => void }) {
  const [token, setToken] = useState<string>("");
  useEffect(() => {
    setToken(getOrCreateToken());
  }, []);
  const [msgs, setMsgs] = useState<GuestMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [introDone, setIntroDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("pra_guest_intro_done");
  });
  const endRef = useRef<HTMLDivElement>(null);

  // initial load
  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/guest-chat?guest_token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        setMsgs(d.messages ?? []);
        if ((d.messages ?? []).length > 0) setIntroDone(true);
      })
      .catch(() => {});
  }, [token]);

  // poll every 5s for staff replies
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/public/guest-chat?guest_token=${encodeURIComponent(token)}`);
        const d = await r.json();
        setMsgs(d.messages ?? []);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    // optimistic
    const optimistic: GuestMsg = { id: `tmp_${Date.now()}`, sender: "guest", body: text, created_at: new Date().toISOString() };
    setMsgs((m) => [...m, optimistic]);
    try {
      const r = await fetch("/api/public/guest-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guest_token: token, message: text, display_name: name || undefined, email: email || undefined }),
      });
      const d = await r.json();
      if (d.bot_reply) {
        setMsgs((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          { ...optimistic, id: `u_${Date.now()}` },
          { id: `b_${Date.now()}`, sender: "bot", body: d.bot_reply, created_at: new Date().toISOString() },
        ]);
      } else {
        // refetch
        const rr = await fetch(`/api/public/guest-chat?guest_token=${encodeURIComponent(token)}`);
        const dd = await rr.json();
        setMsgs(dd.messages ?? []);
      }
    } finally {
      setSending(false);
    }
  };

  const startChat = () => {
    setIntroDone(true);
    localStorage.setItem("pra_guest_intro_done", "1");
  };

  return (
    <Card className="flex h-[520px] flex-col overflow-hidden border-2 shadow-2xl">
      <Header ar={ar} onClose={onClose} subtitle={ar ? "مساعد PRA الذكي" : "PRA AI Assistant"} />
      {!introDone ? (
        <div className="flex-1 space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            {ar ? "أهلاً بك! اكتب اسمك وبريدك (اختياري) ثم ابدأ الدردشة." : "Welcome! Optionally enter your name and email, then start chatting."}
          </p>
          <Input placeholder={ar ? "الاسم (اختياري)" : "Name (optional)"} value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder={ar ? "البريد (اختياري)" : "Email (optional)"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="w-full" onClick={startChat}>
            {ar ? "ابدأ المحادثة" : "Start chat"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
            {msgs.length === 0 && (
              <BubbleRow sender="bot">{ar ? "مرحباً! كيف يمكنني مساعدتك اليوم؟" : "Hi! How can I help you today?"}</BubbleRow>
            )}
            {msgs.map((m) => (
              <BubbleRow key={m.id} sender={m.sender}>{m.body}</BubbleRow>
            ))}
            {sending && <div className="text-xs text-muted-foreground">{ar ? "يكتب…" : "Typing…"}</div>}
            <div ref={endRef} />
          </div>
          <Composer ar={ar} value={input} onChange={setInput} onSend={send} sending={sending} />
        </>
      )}
    </Card>
  );
}

// ------------------ Authenticated support chat (compact) ------------------
function AuthedSupportChat({ ar, onClose }: { ar: boolean; onClose: () => void }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  // Get/create conversation via server fn
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getOrCreateMyConversation } = await import("@/lib/chat.functions");
        const id = await getOrCreateMyConversation({ data: { kind: "support" } });
        if (mounted) setConvId(id);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!convId) return;
    let cancelled = false;
    const load = async () => {
      const { listMessages } = await import("@/lib/chat.functions");
      try {
        const list = await listMessages({ data: { conversation_id: convId } });
        if (!cancelled) setMsgs(list as any[]);
      } catch {}
    };
    load();
    const ch = supabase
      .channel(`fchat-${convId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${convId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || !convId || sending) return;
    setSending(true);
    setInput("");
    try {
      const { sendChatMessage } = await import("@/lib/chat.functions");
      await sendChatMessage({ data: { conversation_id: convId, body: text } });
      // Fire-and-forget bot trigger
      const { triggerSupportBotReply } = await import("@/lib/bot.functions");
      triggerSupportBotReply({ data: { conversation_id: convId } }).catch(() => {});
    } catch (e: any) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex h-[520px] flex-col overflow-hidden border-2 shadow-2xl">
      <Header ar={ar} onClose={onClose} subtitle={ar ? "الدعم المباشر" : "Live support"} />
      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
        {msgs.length === 0 && (
          <BubbleRow sender="bot">
            {ar ? "أهلاً! أنا مساعد PRA الذكي. اسألني أي شيء، ولو احتجت تدخل بشري سيرد عليك المشرف." : "Hi! I'm the PRA AI assistant. Ask me anything; a human will jump in if needed."}
          </BubbleRow>
        )}
        {msgs.map((m: any) => {
          if (m.kind === "system") {
            return (
              <div key={m.id} className="text-center">
                <span className="inline-block rounded-full border bg-background px-3 py-1 text-[11px] text-muted-foreground">{m.body}</span>
              </div>
            );
          }
          const sender: GuestMsg["sender"] = m.kind === "bot" ? "bot" : m.sender_id === meId ? "guest" : "staff";
          return (
            <BubbleRow key={m.id} sender={sender}>
              {m.body}
            </BubbleRow>
          );
        })}
        {sending && <div className="text-xs text-muted-foreground">{ar ? "يكتب…" : "Typing…"}</div>}
        <div ref={endRef} />
      </div>
      <Composer ar={ar} value={input} onChange={setInput} onSend={send} sending={sending} />
    </Card>
  );
}

// ------------------ Shared pieces ------------------
function Header({ ar, onClose, subtitle }: { ar: boolean; onClose: () => void; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-[image:var(--gradient-primary)] px-4 py-3 text-primary-foreground">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">PRA</div>
          <div className="text-[11px] opacity-90">{subtitle}</div>
        </div>
      </div>
      <button aria-label={ar ? "إغلاق" : "Close"} onClick={onClose} className="rounded-full p-1 hover:bg-white/15">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Composer({ ar, value, onChange, onSend, sending }: { ar: boolean; value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean }) {
  return (
    <div className="border-t bg-background p-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={ar ? "اكتب رسالتك…" : "Type a message…"}
          rows={1}
          className="min-h-[40px] flex-1 resize-none"
        />
        <Button onClick={onSend} disabled={sending || !value.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BubbleRow({ sender, children }: { sender: GuestMsg["sender"]; children: React.ReactNode }) {
  const mine = sender === "guest";
  return (
    <div className={cn("flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", sender === "bot" ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-600")}>
          {sender === "bot" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-background border",
        )}
      >
        {children}
      </div>
    </div>
  );
}
