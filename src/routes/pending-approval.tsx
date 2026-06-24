import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/pending-approval")({
  ssr: false,
  component: PendingApproval,
});

function PendingApproval() {
  const { t } = useTranslation();
  const onSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60 shadow-[var(--shadow-elegant)]">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3">{t("auth.pendingTitle")}</CardTitle>
          <CardDescription>{t("auth.pendingMsg")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()}>{t("common.refresh") || "Refresh"}</Button>
          <Button variant="outline" onClick={onSignOut}>
            {t("nav.signOut")}
          </Button>
          <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
            ← {t("brand")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
