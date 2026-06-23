import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, Briefcase, BarChart3, Globe2, ArrowRight, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { setLocale } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRA Career Portal — Enterprise AI Workforce Platform" },
      {
        name: "description",
        content:
          "Multi-tenant AI platform for HR companies and recruitment agencies. Generate ATS-grade CVs, match talent to roles, and manage your workforce at scale.",
      },
      { property: "og:title", content: "PRA Career Portal — Enterprise AI Workforce Platform" },
      {
        property: "og:description",
        content: "AI CV generation, intelligent job matching, and enterprise tenant management in one SaaS.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = (localStorage.getItem("pra_theme") as any) || "light";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
    const lng = localStorage.getItem("pra_locale") === "ar" ? "ar" : "en";
    document.documentElement.lang = lng;
    document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("pra_theme", next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="truncate text-lg font-semibold">{t("brand")}</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocale(i18n.language === "ar" ? "en" : "ar")} className="gap-1.5">
              <Globe2 className="h-4 w-4" />
              {i18n.language === "ar" ? "EN" : "العربية"}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/pricing" className="hidden sm:block">
              <Button variant="ghost" size="sm">{t("landing.ctaSecondary")}</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">{t("nav.signIn")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,white_0%,transparent_60%)] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {t("landing.heroEyebrow")}
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-white/85 sm:text-lg">{t("landing.heroSub")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90">
                {t("landing.ctaPrimary")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                {t("landing.ctaSecondary")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: t("landing.feat1Title"), body: t("landing.feat1Body") },
            { icon: Sparkles, title: t("landing.feat2Title"), body: t("landing.feat2Body") },
            { icon: Briefcase, title: t("landing.feat3Title"), body: t("landing.feat3Body") },
            { icon: BarChart3, title: t("landing.feat4Title"), body: t("landing.feat4Body") },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">{t("landing.trustedBy")}</p>
          <div className="mt-8 flex justify-center">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                {t("landing.ctaPrimary")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("brand")}
      </footer>
    </div>
  );
}
