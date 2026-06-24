import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/lib/notifications.hooks";
import { fmtCairo } from "@/lib/time";
import { cn } from "@/lib/utils";

function timeAgo(iso: string, ar: boolean) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return ar ? "الآن" : "now";
  if (m < 60) return ar ? `منذ ${m} د` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return ar ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  return ar ? `منذ ${d} يوم` : `${d}d`;
}

export function NotificationBell() {
  const { notifications, unread, markAllRead, markRead } = useNotifications();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === "ar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 px-1 text-[10px] font-bold text-white shadow ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">{ar ? "الإشعارات" : "Notifications"}</div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {ar ? "تحديد الكل كمقروء" : "Mark all read"}
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground">
              {ar ? "لا توجد إشعارات بعد" : "No notifications yet"}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  if (n.link) navigate({ to: n.link as any });
                }}
                className={cn(
                  "block w-full border-b px-4 py-3 text-start transition hover:bg-muted/50",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">{n.title}</div>
                      <div className="shrink-0 text-[10px] text-muted-foreground" title={fmtCairo(n.created_at, ar)}>
                        {timeAgo(n.created_at, ar)}
                      </div>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {n.body}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
