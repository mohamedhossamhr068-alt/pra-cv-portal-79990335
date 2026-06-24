import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + "/pending-approval",
          data: { full_name: fullName || undefined, company_name: company || undefined },
        },
      });
      if (error) throw error;
      toast.success(t("auth.codeSent", { email }));
      setStep("code");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // approval gate inside _authenticated will route to /pending-approval if needed
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[image:var(--gradient-hero)] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,white_0%,transparent_60%)] opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">{t("brand")}</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight">{t("auth.signUpTitle")}</h2>
            <p className="mt-3 max-w-md text-white/85">{t("auth.signUpSub")}</p>
          </div>
          <div className="text-xs text-white/70">© {new Date().getFullYear()} {t("brand")}</div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60 shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle>{step === "email" ? t("auth.signInTitle") : t("auth.enterCode")}</CardTitle>
            <CardDescription>
              {step === "email" ? t("auth.signUpSub") : t("auth.codeSent", { email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {step === "email" ? (
              <>
                <Button variant="outline" className="w-full" onClick={onGoogle} disabled={loading}>
                  {t("auth.google")}
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  {t("auth.or")}
                  <div className="h-px flex-1 bg-border" />
                </div>
                <form className="flex flex-col gap-3" onSubmit={sendCode}>
                  <div>
                    <Label htmlFor="fn">{t("auth.fullName")}</Label>
                    <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="co">{t("auth.company")}</Label>
                    <Input id="co" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="em">{t("auth.email")}</Label>
                    <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" disabled={loading || !email} className="mt-2">
                    {loading ? t("auth.sending") : t("auth.sendCode")}
                  </Button>
                </form>
                <p className="text-center text-xs text-muted-foreground">{t("auth.awaitingApproval")}</p>
              </>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={verifyCode}>
                <div>
                  <Label htmlFor="code">{t("auth.enterCode")}</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="text-center text-2xl tracking-[0.5em]"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading || code.length < 6}>
                  {loading ? t("auth.verifying") : t("auth.verify")}
                </Button>
                <div className="flex justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("email")}>
                    ← {t("auth.changeEmail")}
                  </button>
                  <button type="button" className="text-primary hover:underline" onClick={() => sendCode()} disabled={loading}>
                    {t("auth.resend")}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
