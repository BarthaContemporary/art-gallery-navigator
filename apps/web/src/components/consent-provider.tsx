"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  CONSENT_EVENT,
  clearConsent,
  readConsent,
  writeConsent,
  type ConsentRecord,
  type ConsentState,
  type Purpose,
} from "@/lib/consent";

type Ctx = {
  /** null until read from storage after mount, then the record or null. */
  state: ConsentState;
  /** False until the first client read completes — gates render, not logic. */
  ready: boolean;
  decided: boolean;
  granted: (p: Purpose) => boolean;
  decide: (choice: { analytics: boolean; marketing: boolean }) => void;
  /** Re-open the banner from the footer to change or withdraw a decision. */
  reopen: () => void;
  reopenRequested: boolean;
};

const ConsentContext = createContext<Ctx | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConsentState>(null);
  const [ready, setReady] = useState(false);
  const [reopenRequested, setReopenRequested] = useState(false);

  // Read once after mount. Server render always assumes "undecided and not
  // ready", so no markup depends on storage and hydration stays stable.
  useEffect(() => {
    setState(readConsent());
    setReady(true);
    const onChange = (e: Event) => {
      setState((e as CustomEvent<ConsentRecord | null>).detail ?? null);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const decide = useCallback((choice: { analytics: boolean; marketing: boolean }) => {
    const record = writeConsent({
      analytics: choice.analytics ? "granted" : "denied",
      marketing: choice.marketing ? "granted" : "denied",
    });
    setState(record);
    setReopenRequested(false);
  }, []);

  const reopen = useCallback(() => {
    // Clearing first means "withdraw, then re-ask" — a withdrawal takes effect
    // immediately even if the visitor abandons the banner without choosing.
    clearConsent();
    setState(null);
    setReopenRequested(true);
  }, []);

  const grantedFn = useCallback((p: Purpose) => state?.[p] === "granted", [state]);

  return (
    <ConsentContext.Provider
      value={{
        state,
        ready,
        decided: state !== null,
        granted: grantedFn,
        decide,
        reopen,
        reopenRequested,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): Ctx {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside <ConsentProvider>");
  return ctx;
}
