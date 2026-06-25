import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export type BotContext = {
  audience: "guest" | "user";
  currency?: string | null;
  planFree?: number | null;
  planPro?: number | null;
  planBusiness?: number | null;
  creditsPro?: number | null;
  creditsBusiness?: number | null;
  egpPerCredit?: number | null;
};

const FEATURES_AR = `مميزات منصة PRA:
- بناء سيرة ذاتية احترافية بقوالب جاهزة + تصدير PDF.
- تحليل سيرتك الذاتية ومطابقتها مع الوظائف المتاحة بذكاء اصطناعي.
- جلب وظائف من مصادر متعددة (Job scraping) ومطابقة فورية بنسبة توافق.
- محفظة كرديت ودفع محلي عبر فودافون كاش / إنستاباي / تحويل بنكي.
- لوحة شركات: إدارة فريق، صلاحيات، عروض، إعلانات وظائف.`;

const FEATURES_EN = `PRA platform features:
- Build a professional CV with ready templates + PDF export.
- AI-powered CV analysis and job matching with a compatibility score.
- Job scraping from multiple sources with instant matching.
- Credit wallet + local payment (Vodafone Cash, InstaPay, bank transfer).
- Company panel: team, roles, offers, job postings.`;

const ROUTES_AR = `الصفحات داخل التطبيق (وجِّه المستخدم لها بكتابتها بين قوسين، مثلاً: [/cv/new]):
- /dashboard — الرئيسية ولمحة عامة
- /cv/new — إنشاء سيرة ذاتية جديدة
- /cv — قائمة السير الذاتية
- /jobs — البحث عن وظائف ومطابقتها
- /billing — الاشتراكات والخطط
- /billing/topup — شحن الرصيد
- /billing/history — سجل المعاملات
- /settings — الإعدادات
- /chat/support — الدعم المباشر
- /chat/credit — طلب كرديت من الأدمن`;

const ROUTES_EN = `In-app routes (refer users with paths like [/cv/new]):
- /dashboard — overview
- /cv/new — create a new CV
- /cv — CV list
- /jobs — search & match jobs
- /billing — plans & subscriptions
- /billing/topup — top up credits
- /billing/history — transaction history
- /settings — settings
- /chat/support — live support
- /chat/credit — request credits`;

function pricingBlock(ctx: BotContext, ar: boolean): string {
  const cur = ctx.currency || "EGP";
  const lines: string[] = [];
  if (ctx.egpPerCredit) {
    lines.push(
      ar
        ? `سعر الكرديت: ${ctx.egpPerCredit} ${cur} = 1 كرديت (الحد الأدنى للشحن).`
        : `Credit price: ${ctx.egpPerCredit} ${cur} = 1 credit (minimum top-up).`,
    );
  }
  if (ctx.planFree != null || ctx.planPro != null || ctx.planBusiness != null) {
    lines.push(ar ? "الخطط:" : "Plans:");
    if (ctx.planFree != null) lines.push(ar ? `- مجانية: ${ctx.planFree} ${cur}` : `- Free: ${ctx.planFree} ${cur}`);
    if (ctx.planPro != null)
      lines.push(
        ar
          ? `- Pro: ${ctx.planPro} ${cur}${ctx.creditsPro ? ` (تشمل ${ctx.creditsPro} كرديت)` : ""}`
          : `- Pro: ${ctx.planPro} ${cur}${ctx.creditsPro ? ` (includes ${ctx.creditsPro} credits)` : ""}`,
      );
    if (ctx.planBusiness != null)
      lines.push(
        ar
          ? `- Business: ${ctx.planBusiness} ${cur}${ctx.creditsBusiness ? ` (تشمل ${ctx.creditsBusiness} كرديت)` : ""}`
          : `- Business: ${ctx.planBusiness} ${cur}${ctx.creditsBusiness ? ` (includes ${ctx.creditsBusiness} credits)` : ""}`,
      );
  }
  return lines.join("\n");
}

export function buildBotSystem(lang: string | undefined | null, sampleText: string | undefined, ctx: BotContext): string {
  const l = (lang || "").toLowerCase();
  const ar = l.startsWith("ar") || (!l.startsWith("en") && !!sampleText && /[\u0600-\u06FF]/.test(sampleText));
  const audience = ctx.audience;
  const pricing = pricingBlock(ctx, ar);

  if (ar) {
    const intro = `أنت "مساعد PRA"، مساعد ذكي ودود لمنصة PRA المهنية. ردّ بالعربية الفصحى المبسطة، باختصار وبفقرات قصيرة، استخدم نقاطاً (•) عند الحاجة.`;
    const audienceLine =
      audience === "guest"
        ? `الزائر الحالي غير مسجّل: اشرح المميزات والأسعار فقط، وادعُه للتسجيل قبل أي إجراء داخل التطبيق. لا تشارك روابط داخلية للزوار غير المسجّلين.`
        : `المستخدم مسجّل دخوله: لو سأل عن أي ميزة، اذكر الصفحة المناسبة داخل التطبيق بين قوسين مربّعين بالضبط مثل [/cv/new] حتى يستطيع الضغط عليها مباشرة.`;
    return [
      intro,
      audienceLine,
      FEATURES_AR,
      pricing && `الأسعار الحالية:\n${pricing}`,
      audience === "user" ? ROUTES_AR : "",
      `قواعد:\n- لا تختلق معلومات أو أسعار، استخدم الأرقام المذكورة أعلاه فقط.\n- إن احتاج المستخدم تدخّل بشري (شكاوى، مشاكل دفع)، اقترح [/chat/support] أو قُل سيتم تحويله لمشرف.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const intro = `You are "PRA Assistant", a friendly AI assistant for the PRA career platform. Reply in clear, concise English using short paragraphs and bullets when useful.`;
  const audienceLine =
    audience === "guest"
      ? `The current visitor is NOT signed in: explain features and pricing only, and invite them to sign up before any in-app action. Do not share internal app links with guests.`
      : `The user is signed in: when they ask about a feature, mention the matching in-app route in square brackets exactly like [/cv/new] so they can click it.`;
  return [
    intro,
    audienceLine,
    FEATURES_EN,
    pricing && `Current pricing:\n${pricing}`,
    audience === "user" ? ROUTES_EN : "",
    `Rules:\n- Don't invent info or prices; use only the numbers above.\n- If the user needs a human (complaints, payment issues), point to [/chat/support] or say a moderator will follow up.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Back-compat: minimal system used by older callers. */
export function pickBotSystem(lang: string | undefined | null, sampleText?: string) {
  return buildBotSystem(lang, sampleText, { audience: "guest" });
}

export async function fetchBotPricing(): Promise<Omit<BotContext, "audience">> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_pricing" as any)
      .select("currency, plan_price_free, plan_price_pro, plan_price_business, plan_credits_pro, plan_credits_business")
      .eq("id", "global")
      .maybeSingle();
    const p = (data ?? {}) as any;
    // egp_per_credit derived from tenants default rate (1 / rate). Fall back to 50.
    let egpPerCredit = 50;
    try {
      const { data: t } = await supabaseAdmin
        .from("tenants" as any)
        .select("scrape_credit_cost")
        .limit(1)
        .maybeSingle();
      // not actually rate; keep 50 default unless platform_pricing has more info
      void t;
    } catch {}
    return {
      currency: p.currency ?? "EGP",
      planFree: p.plan_price_free ?? null,
      planPro: p.plan_price_pro ?? null,
      planBusiness: p.plan_price_business ?? null,
      creditsPro: p.plan_credits_pro ?? null,
      creditsBusiness: p.plan_credits_business ?? null,
      egpPerCredit,
    };
  } catch {
    return { audience: "guest" as any, egpPerCredit: 50 } as any;
  }
}
