import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "@/components/chat-panel";
import { getOrCreateMyConversation } from "@/lib/chat.functions";
import { useMeQuery } from "@/lib/me.hooks";

export const Route = createFileRoute("/_authenticated/chat/credit")({
  component: CreditChat,
});

function CreditChat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const me = useMeQuery();
  const fn = useServerFn(getOrCreateMyConversation);
  const q = useQuery({
    queryKey: ["my-conv", "credit"],
    queryFn: () => fn({ data: { kind: "credit" } }),
    enabled: !!me.data,
  });

  if (me.isLoading) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? "طلبات الكرديت" : "Credit requests"}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "أرسل طلب زيادة كرديت إلى الأدمن. عند الموافقة تُضاف إلى رصيدك تلقائياً."
            : "Request more credits from the admin. On approval, credits are added automatically."}
        </p>
      </div>
      {q.data && <ChatPanel conversationId={q.data} kind="credit" showCreditRequest />}
    </div>
  );
}
