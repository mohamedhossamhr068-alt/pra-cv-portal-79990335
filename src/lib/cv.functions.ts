import { z } from "zod";

// 1. تحديد القوالب المتاحة في النظام ككل (قالبين فقط)
export const availableTemplates = [
  { id: 'modern_executive', name: 'Modern Executive' },
  { id: 'corporate_minimal', name: 'Corporate Minimal' }
] as const;

// 2. إعداد الـ Zod Schema لضمان عدم قبول أي قالب آخر من قاعدة البيانات أو الـ API
export const cvFormSchema = z.object({
  templateId: z.enum(["modern_executive", "corporate_minimal"]),
  
  // يمكنك إضافة باقي الحقول هنا مستقبلاً (مثل الاسم، المسمى الوظيفي، إلخ)
  fullName: z.string().optional(),
  jobTitle: z.string().optional(),
});

export type CVFormValues = z.infer<typeof cvFormSchema>;
