import { useEffect, useMemo, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /android/.test(window.navigator.userAgent.toLowerCase());
}

function isBrowserPreviewFrame(): boolean {
  if (typeof window === "undefined") return true;
  return window.self !== window.top;
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const ios = useMemo(() => isIos(), []);
  const android = useMemo(() => isAndroid(), []);

  useEffect(() => {
    if (isBrowserPreviewFrame() || isStandalone()) return;

    setVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setVisible(false);
      toast.success("تم تثبيت PRA كتطبيق بنجاح");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
      return;
    }

    if (ios) {
      toast("لتثبيت التطبيق على iPhone", {
        description: "افتح الرابط من Safari، اضغط زر المشاركة، ثم Add to Home Screen.",
        icon: <Share className="h-4 w-4" />,
      });
      return;
    }

    if (android) {
      toast("لتثبيت التطبيق", {
        description: "افتح قائمة Chrome ⋮ ثم اختر Add to Home screen أو Install app.",
        icon: <Smartphone className="h-4 w-4" />,
      });
      return;
    }

    toast("لتثبيت PRA كتطبيق", {
      description: "من Chrome أو Edge اضغط علامة التثبيت ⊕ في شريط العنوان، أو افتح القائمة واختر Install app.",
      icon: <Download className="h-4 w-4" />,
    });
  };

  if (!visible) return null;

  return (
    <Button
      type="button"
      onClick={handleInstall}
      className="fixed bottom-5 start-5 z-50 h-12 gap-2 rounded-full px-4 shadow-[var(--shadow-elegant)]"
      aria-label="Install PRA app"
    >
      <Download className="h-4 w-4" />
      <span>تثبيت التطبيق</span>
    </Button>
  );
}