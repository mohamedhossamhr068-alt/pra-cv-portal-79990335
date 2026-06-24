import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { fmtCairoTime } from "@/lib/time";

export function CairoClock({ ar }: { ar: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium tabular-nums sm:flex"
      title={ar ? "توقيت القاهرة" : "Cairo time"}
    >
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{fmtCairoTime(now, ar)}</span>
      <span className="text-muted-foreground">{ar ? "القاهرة" : "Cairo"}</span>
    </div>
  );
}
