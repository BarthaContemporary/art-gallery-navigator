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

/** No token and no request to interact after this long: the check is not coming. */
const GIVE_UP_MS = 10_000;

/**
 * Cloudflare Turnstile challenge, invisible in the normal case: with
 * `appearance: "interaction-only"` the check runs silently and the widget
 * only draws itself when a visitor genuinely has to interact. Calls `onToken`
 * with the solved token (and with "" when it expires/errors). Renders nothing
 * until a site key is configured, so the forms keep working without Turnstile.
 *
 * Calls `onUnavailable` when the check cannot run: the script does not load
 * (a content blocker, a filtering network or proxy), rendering fails, the
 * browser is unsupported, the widget reports an error, or neither a token
 * nor a request to interact has come after ten seconds. The server still
 * refuses a form without a token, so the form then says so and offers
 * another way to reach the gallery (TurnstileUnavailable) instead of
 * asking the visitor to wait for ever. Remounting the widget (the forms'
 * `key={turnstileRound}`) tries the script again.
 */
export function TurnstileWidget({
  onToken,
  onUnavailable,
  className,
}: {
  onToken: (token: string) => void;
  onUnavailable?: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Keep the latest callbacks without re-rendering the widget.
  const cb = useRef(onToken);
  cb.current = onToken;
  const down = useRef(onUnavailable);
  down.current = onUnavailable;

  useEffect(() => {
    if (!SITE_KEY || !hostRef.current) return;
    let cancelled = false;
    let timer: number | undefined;
    const stopTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const unavailable = () => {
      stopTimer();
      if (!cancelled) down.current?.();
    };
    loadTurnstile()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        // Waiting on the visitor's click (before-interactive) is not a failure.
        timer = window.setTimeout(unavailable, GIVE_UP_MS);
        widgetId.current = window.turnstile.render(hostRef.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          theme: "light",
          callback: (token: string) => {
            stopTimer();
            cb.current(token);
          },
          "expired-callback": () => cb.current(""),
          "error-callback": () => {
            cb.current("");
            unavailable();
          },
          "unsupported-callback": unavailable,
          "before-interactive-callback": stopTimer,
        });
      })
      .catch(unavailable);
    return () => {
      cancelled = true;
      stopTimer();
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

/**
 * What a form says when the anti-spam check cannot run: why, a way to try
 * again (remounting the widget reloads the script), and another way to
 * reach the gallery (the About page gives the address and telephone).
 * `className` matches the form's own colours.
 */
export function TurnstileUnavailable({
  onRetry,
  className = "font-sans text-small text-accent-deep",
}: {
  onRetry: () => void;
  className?: string;
}) {
  return (
    <p className={className} role="alert">
      The anti-spam check could not load, so this form cannot be sent just now. A content blocker or a network
      filter may be stopping it.{" "}
      <button type="button" onClick={onRetry} className="underline">
        Try again
      </button>
      , or{" "}
      <a href="/about" className="underline">
        contact the gallery directly
      </a>
      .
    </p>
  );
}
