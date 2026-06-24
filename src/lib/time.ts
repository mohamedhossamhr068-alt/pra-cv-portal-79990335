// Egypt timezone (Africa/Cairo) date/time helpers.
const TZ = "Africa/Cairo";

function loc(ar: boolean | string | undefined): string {
  const isAr = typeof ar === "string" ? ar === "ar" : !!ar;
  return isAr ? "ar-EG" : "en-GB";
}

export function fmtCairo(
  date: string | number | Date | null | undefined,
  ar?: boolean | string,
): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(loc(ar), {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtCairoDate(
  date: string | number | Date | null | undefined,
  ar?: boolean | string,
): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(loc(ar), {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function fmtCairoTime(
  date: string | number | Date | null | undefined,
  ar?: boolean | string,
): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(loc(ar), {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}
