"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile CAPTCHA. Renders nothing when no site key is configured (local development). */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let widgetId: string | undefined;
    const el = ref.current;

    const render = () => {
      if (window.turnstile && el && !widgetId) {
        widgetId = window.turnstile.render(el, { sitekey: SITE_KEY, callback: onToken, "expired-callback": () => onToken(null) });
      }
    };

    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}

export const captchaEnabled = Boolean(SITE_KEY);
