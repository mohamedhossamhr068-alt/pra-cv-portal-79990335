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

export const BOT_SYSTEM_AR = `أنت مساعد دعم ودود لمنصة PRA (منصة مهنية للأفراد والشركات لإنشاء وتحليل السير الذاتية وربطها بفرص العمل).
- ردّ بالعربية الفصحى المبسطة.
- كن مختصراً ومحترفاً ومفيداً.
- ساعد في: إنشاء/تحسين السيرة الذاتية، البحث عن وظائف، خطط الاشتراك، الكرديت، استخدام المنصة.
- لو السؤال يحتاج تدخل بشري (مشاكل دفع، شكاوى، طلبات خاصة): قل للمستخدم إن أحد المشرفين سيرد عليه قريباً.
- لا تختلق معلومات. ولا تذكر أنك ذكاء اصطناعي إلا لو سُئلت مباشرة.`;

export const BOT_SYSTEM_EN = `You are a friendly support assistant for PRA (a career platform for individuals and companies to build/analyze CVs and match to job opportunities).
- Reply in clear, professional English.
- Be concise, helpful, and friendly.
- Help with: CV creation/improvement, job search, subscription plans, credits, using the platform.
- If the request needs a human (payment issues, complaints, special requests): tell the user a moderator will follow up shortly.
- Do not make up information. Don't mention being an AI unless directly asked.`;

/** Pick system prompt by explicit lang hint, falling back to detection on the latest text. */
export function pickBotSystem(lang: string | undefined | null, sampleText?: string) {
  const l = (lang || "").toLowerCase();
  if (l.startsWith("ar")) return BOT_SYSTEM_AR;
  if (l.startsWith("en")) return BOT_SYSTEM_EN;
  // detect: any Arabic char => AR
  if (sampleText && /[\u0600-\u06FF]/.test(sampleText)) return BOT_SYSTEM_AR;
  return BOT_SYSTEM_EN;
}
