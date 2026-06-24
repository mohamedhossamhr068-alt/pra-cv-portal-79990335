import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "@/components/chat-panel";
import { getOrCreateMyConversation } from "@/lib/chat.functions";
import { useMeQuery } from "@/lib/me.hooks";

export const Route = createFileRoute("/_authenticated/chat/support")({
  component: SupportChat,
});

function SupportChat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const fn = useServerFn(getOrCreateMyConversation);
  useMeQuery();
  const q = useQuery({
    queryKey: ["my-conv", "support"],
    queryFn: () => fn({ data: { kind: "support" } }),
  });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? "الدعم والمساعدة" : "Support"}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "اكتب سؤالك هنا — سيظهر للأدمن والمشرفين ويتم الرد عليك."
            : "Send questions to the admins & moderators."}
        </p>
      </div>
      {q.data && <ChatPanel conversationId={q.data} kind="support" />}
    </div>
  );
}
