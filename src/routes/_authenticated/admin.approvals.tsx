import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtCairo } from "@/lib/time";
import { Check, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, is_approved, is_blocked")
        .eq("is_approved", false)
        .eq("is_blocked", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const review = async (userId: string, approve: boolean) => {
    const note = approve ? null : window.prompt(ar ? "سبب الرفض (اختياري)" : "Reason (optional)") ?? null;
    const { error } = await supabase.rpc("admin_approve_signup" as any, {
      _user_id: userId,
      _approve: approve,
      _note: note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ar ? (approve ? "تم التفعيل" : "تم الرفض") : approve ? "Approved" : "Rejected");
    qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserPlus className="h-6 w-6" />
          {ar ? "طلبات الانضمام" : "Pending approvals"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar ? "وافق أو ارفض المستخدمين الجدد لتفعيل حساباتهم." : "Approve or reject new sign-ups to activate their accounts."}
        </p>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {ar ? "لا توجد طلبات معلقة." : "No pending requests."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {q.data!.map((u: any) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{u.full_name || u.email}</CardTitle>
                <CardDescription>
                  {u.email} · {fmtCairo(u.created_at, ar)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => review(u.id, false)}>
                  <X className="me-1 h-4 w-4" /> {ar ? "رفض" : "Reject"}
                </Button>
                <Button size="sm" onClick={() => review(u.id, true)}>
                  <Check className="me-1 h-4 w-4" /> {ar ? "موافقة" : "Approve"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
