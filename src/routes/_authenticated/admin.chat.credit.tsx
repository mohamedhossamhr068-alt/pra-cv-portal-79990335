import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { listConversations } from "@/lib/chat.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtCairo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/admin/chat/credit")({
  component: AdminCreditChat,
});

function AdminCreditChat() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const me = useMeQuery();
  const fn = useServerFn(listConversations);
  const isAdmin = me.data?.roles?.includes("company_admin");
  const q = useQuery({
    queryKey: ["conversations", "credit"],
    queryFn: () => fn({ data: { kind: "credit" } }),
    enabled: !!isAdmin,
    refetchInterval: 15000,
  });
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!active && q.data?.[0]) setActive(q.data[0].id);
  }, [q.data, active]);

  if (!isAdmin) return <div className="text-sm text-muted-foreground">{ar ? "للأدمن فقط" : "Admin only"}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ar ? "طلبات الكرديت من المشرفين" : "Moderator credit requests"}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {q.data?.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {ar ? "لا توجد طلبات." : "No requests yet."}
              </div>
            )}
            {q.data?.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  "block w-full text-start p-3 hover:bg-muted/50",
                  active === c.id && "bg-muted",
                )}
              >
                <div className="font-medium truncate">
                  {c.owner?.full_name ?? c.owner?.email ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {fmtCairo(c.last_message_at, ar)}
                </div>
              </button>
            ))}
          </div>
        </Card>
        <div>
          {active ? (
            <ChatPanel conversationId={active} kind="credit" canReview />
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              {ar ? "اختر محادثة" : "Select a conversation"}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
