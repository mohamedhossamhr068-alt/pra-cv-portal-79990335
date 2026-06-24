import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Sparkles, Briefcase, Users, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PRA — Join your career platform" },
      {
        name: "description",
        content:
          "Access PRA: AI CV generation, job matching, and professional career tools for individuals and companies.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function mapAuthError(t: (k: string) => string, msg: string | undefined, kind: "email" | "code"): string {
  const m = (msg ?? "").toLowerCase();
  if (!m) return kind === "email" ? t("auth.errEmailInvalid") : t("auth.errCodeInvalid");
  if (m.includes("rate") || m.includes("too many") || m.includes("429")) return t("auth.errRate");
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) return t("auth.errNetwork");
  if (kind === "code" && (m.includes("invalid") || m.includes("expired") || m.includes("otp") || m.includes("token")))
    return t("auth.errCodeInvalid");
  if (kind === "email" && (m.includes("invalid") || m.includes("email"))) return t("auth.errEmailInvalid");
  return msg ?? "";
}

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const emailSchema = z
    .string()
    .trim()
    .min(1, t("auth.errEmailRequired"))
    .max(255, t("auth.errEmailTooLong"))
    .email(t("auth.errEmailInvalid"));

  const codeSchema = z
    .string()
    .trim()
    .min(1, t("auth.errCodeRequired"))
    .regex(/^\d+$/, t("auth.errCodeDigits"))
    .length(6, t("auth.errCodeShort"));

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setEmailError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? t("auth.errEmailInvalid"));
      return;
    }
    setLoading(true);
    setStatus(t("auth.statusSending"));
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + "/pending-approval",
          data: { full_name: fullName || undefined, company_name: company || undefined },
        },
      });
      if (error) throw error;
      toast.success(t("auth.codeSent", { email: parsed.data }));
      setStep("code");
      setCode("");
      setCodeError(null);
    } catch (err: any) {
      const friendly = mapAuthError(t, err?.message, "email");
      setEmailError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? t("auth.errCodeInvalid"));
      return;
    }
    setLoading(true);
    setStatus(t("auth.statusVerifying"));
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: parsed.data,
        type: "email",
      });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const friendly = mapAuthError(t, err?.message, "code");
      setCodeError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };


  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient brand backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero)] opacity-90" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-accent/30 blur-3xl" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col gap-8 text-white lg:flex">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 backdrop-blur ring-1 ring-white/20">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="text-lg font-semibold tracking-tight">{t("brand")}</span>
          </Link>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              {t("auth.signUpTitle")}
            </h1>
            <p className="max-w-md text-base text-white/80">
              {t("auth.signUpSub")}
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: Sparkles, title: t("landing.feat2Title"), body: t("landing.feat2Body") },
              { icon: Briefcase, title: t("landing.feat3Title"), body: t("landing.feat3Body") },
              { icon: Users, title: t("landing.feat1Title"), body: t("landing.feat1Body") },
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-white/70">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} {t("brand")}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex justify-center lg:justify-end">
          <Card className="w-full max-w-md border-white/20 bg-white/95 shadow-[var(--shadow-elegant)] backdrop-blur-xl dark:bg-card/95">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] lg:hidden">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl tracking-tight">
                {step === "email" ? t("auth.signUpTitle") : t("auth.enterCode")}
              </CardTitle>
              <CardDescription>
                {step === "email" ? t("auth.signUpSub") : t("auth.codeSent", { email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {step === "email" ? (
                <form className="flex flex-col gap-3" onSubmit={sendCode}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="fn">{t("auth.fullName")}</Label>
                    <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="co">{t("auth.company")}</Label>
                    <Input id="co" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="em">{t("auth.email")}</Label>
                    <Input
                      id="em"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading || !email} className="mt-2 h-11">
                    {loading ? t("auth.sending") : t("auth.sendCode")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("auth.awaitingApproval")}
                  </p>
                </form>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={verifyCode}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="code">{t("auth.enterCode")}</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className="h-12 text-center text-2xl tracking-[0.5em]"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading || code.length < 6} className="h-11">
                    {loading ? t("auth.verifying") : t("auth.verify")}
                  </Button>
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setStep("email")}
                    >
                      ← {t("auth.changeEmail")}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => sendCode()}
                      disabled={loading}
                    >
                      {t("auth.resend")}
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
