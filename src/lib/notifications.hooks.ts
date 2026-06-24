import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: any;
  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data } = await supabase
        .from("notifications")
        .select("id,type,title,body,link,metadata,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data as any) ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // seed seen with initial load to avoid toasts on first mount
    (q.data ?? []).forEach((n) => seenRef.current.add(n.id));
  }, [q.data]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const ch = supabase.channel(`notif-${user.id}-${Math.random().toString(36).slice(2, 8)}`);
      ch.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as any;
          if (n && !seenRef.current.has(n.id)) {
            seenRef.current.add(n.id);
            toast(n.title ?? "إشعار جديد", { description: n.body ?? undefined });
          }
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      ).subscribe();
      if (cancelled) {
        supabase.removeChannel(ch);
        return;
      }
      channel = ch;
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);


  const unread = (q.data ?? []).filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return { notifications: q.data ?? [], unread, isLoading: q.isLoading, markAllRead, markRead };
}
