"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile challenge. Calls `onToken` with the solved token (and
 * with "" when it expires/errors). Renders nothing until a site key is
 * configured, so the forms keep working in environments without Turnstile set.
 */
export function TurnstileWidget({
  onToken,
  className,
}: {
  onToken: (token: string) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Keep the latest callback without re-rendering the widget.
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY || !hostRef.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(hostRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      })
      .catch(() => {
        /* network/adblock — leave the form usable */
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={hostRef} className={className} />;
}

/** True when a Turnstile site key is configured (so a token is required). */
export const turnstileEnabled = Boolean(SITE_KEY);
