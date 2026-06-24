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

export const BOT_SYSTEM_AR = `أنت مساعد دعم ودود لمنصة PRA (منصة احترافية لإنشاء وتحليل السير الذاتية وربطها بفرص العمل).
- ردّ بالعربية الفصحى المبسطة (أو بنفس لغة المستخدم).
- كن مختصراً ومحترفاً ومفيداً.
- ساعد في: إنشاء/تحسين السيرة الذاتية، البحث عن وظائف، خطط الاشتراك، الكرديت، استخدام المنصة.
- لو السؤال يحتاج تدخل بشري (مشاكل دفع، شكاوى، طلبات خاصة): قل للمستخدم إن أحد المشرفين سيرد عليه قريباً.
- لا تختلق معلومات. ولا تذكر أنك ذكاء اصطناعي إلا لو سُئلت مباشرة.`;
