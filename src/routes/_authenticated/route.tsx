import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Approval gate: unapproved users land on /pending-approval
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && (profile as any).is_approved === false) {
      throw redirect({ to: "/pending-approval" });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
