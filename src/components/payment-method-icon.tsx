import { Smartphone, Landmark, CreditCard, Wallet } from "lucide-react";

export const PAYMENT_TYPE_META: Record<string, { label: { ar: string; en: string }; color: string; ring: string; Icon: any; mono: string }> = {
  vodafone_cash:  { label: { ar: "فودافون كاش", en: "Vodafone Cash" },   color: "#E60000", ring: "ring-[#E60000]/30", Icon: Smartphone, mono: "VC" },
  orange_cash:    { label: { ar: "أورنج كاش",   en: "Orange Cash" },     color: "#FF7900", ring: "ring-[#FF7900]/30", Icon: Smartphone, mono: "OC" },
  etisalat_cash:  { label: { ar: "اتصالات كاش", en: "Etisalat Cash" },   color: "#006A4E", ring: "ring-[#006A4E]/30", Icon: Smartphone, mono: "EC" },
  we_pay:         { label: { ar: "WE Pay",       en: "WE Pay" },          color: "#7A1FA2", ring: "ring-[#7A1FA2]/30", Icon: Smartphone, mono: "WE" },
  instapay:       { label: { ar: "إنستا باي",    en: "InstaPay" },        color: "#0E5FD8", ring: "ring-[#0E5FD8]/30", Icon: Wallet,     mono: "IP" },
  bank_transfer:  { label: { ar: "تحويل بنكي",   en: "Bank Transfer" },   color: "#1F2937", ring: "ring-slate-400/30",  Icon: Landmark,   mono: "BT" },
  fawry:          { label: { ar: "فوري",         en: "Fawry" },           color: "#F2A900", ring: "ring-amber-400/30",  Icon: CreditCard, mono: "FW" },
  meeza:          { label: { ar: "ميزة",          en: "Meeza" },           color: "#0EA5A4", ring: "ring-teal-400/30",   Icon: CreditCard, mono: "MZ" },
  other:          { label: { ar: "أخرى",         en: "Other" },           color: "#475569", ring: "ring-slate-400/30",  Icon: Wallet,     mono: "··" },
};

export function PaymentMethodIcon({ type, size = 40 }: { type: string; size?: number }) {
  const m = PAYMENT_TYPE_META[type] ?? PAYMENT_TYPE_META.other;
  return (
    <div
      className={`grid place-items-center rounded-2xl ring-1 ${m.ring} text-white font-extrabold tracking-tight shadow-sm`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)` }}
    >
      <span style={{ fontSize: size * 0.35 }}>{m.mono}</span>
    </div>
  );
}
