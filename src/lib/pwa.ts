import { registerSW } from "virtual:pwa-register";

const SW_PATH = "/sw.js";

function shouldRegister(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;

  const hostname = window.location.hostname;
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return false;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return false;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return false;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return false;

  return true;
}

function shouldUnregister(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  const hostname = window.location.hostname;
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;

  return false;
}

async function unregisterStaleSw(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => registration.scope.endsWith("/") && registration.scope.includes(window.location.origin))
      .map(async (registration) => {
        if (registration.active?.scriptURL?.endsWith(SW_PATH)) {
          await registration.unregister();
        }
      }),
  );
}

export function registerPWA(): void {
  if (shouldUnregister()) {
    void unregisterStaleSw();
    return;
  }

  if (!shouldRegister()) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] Service worker registered:", swUrl);
      if (!registration) return;

      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration failed:", error);
    },
  });
}
