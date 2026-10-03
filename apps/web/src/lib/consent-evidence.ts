import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Evidence of consent, kept on the contact (UK GDPR Art. 7(1): the controller
 * must be able to demonstrate consent; PECR reg. 22). We record what the
 * person was shown, which form, when, the browser, and a one-way hash of the
 * address it came from — enough to answer "how do you know I agreed?" without
 * keeping the IP itself.
 */
export const CONSENT_TEXT_VERSION = "2026-10";

export const CONSENT_TEXTS = {
  newsletter:
    "I would like to receive the gallery's newsletter by email and agree to the Privacy Notice. I can unsubscribe at any time.",
  enquiry:
    "I agree to the gallery contacting me about this enquiry and have read the Privacy Notice and Terms.",
  enquiry_mailing_list: "Please also add me to the gallery's mailing list.",
  booking: "I agree to the gallery contacting me about this appointment and have read the Privacy Notice.",
} as const;

export type ConsentEvidence = {
  version: string;
  form: keyof typeof CONSENT_TEXTS;
  text: string;
  at: string;
  ip_hash: string | null;
  user_agent: string | null;
  page: string | null;
  confirmed_at?: string | null;
};

export function consentEvidence(req: NextRequest, form: keyof typeof CONSENT_TEXTS): ConsentEvidence {
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    ?.trim();
  return {
    version: CONSENT_TEXT_VERSION,
    form,
    text: CONSENT_TEXTS[form],
    at: new Date().toISOString(),
    ip_hash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    page: req.headers.get("referer")?.slice(0, 300) ?? null,
  };
}

/** Merge a new piece of evidence into the contact's jsonb, keyed by purpose. */
export function mergeEvidence(
  existing: unknown,
  key: "marketing" | "contact",
  evidence: ConsentEvidence,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {};
  return { ...base, [key]: evidence };
}
