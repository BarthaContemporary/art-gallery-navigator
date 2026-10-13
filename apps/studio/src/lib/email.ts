import { createHash } from "node:crypto";
import { Resend, type CreateEmailOptions } from "resend";

/*
 * Every email the studio sends goes through here: offers, newsletters and
 * their test sends, staff invitations and the sanctions alert.
 *
 * The Resend SDK reports a refused send (unverified sender, bad address,
 * invalid key, rate limit) as a returned `error` rather than throwing. The
 * studio used to await the call inside try/catch and treat "no exception" as
 * sent, so a refused email was stamped sent, logged as sent and counted as
 * sent. sendEmail throws instead, the same contract as the website's
 * apps/web/src/lib/email.ts, so a caller's catch is reached when it should be.
 */

/** A send Resend refused, or that never got an answer. */
export class EmailSendError extends Error {
  /** Resend's error name (rate_limit_exceeded, validation_error, …) or "no_response". */
  readonly code: string;
  /** Resend's own explanation, for logs and the email_events row. */
  readonly detail: string;

  constructor(label: string, code: string, detail: string) {
    super(`${label}: Resend refused the email (${code}: ${detail})`);
    this.name = "EmailSendError";
    this.code = code;
    this.detail = detail;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send one email through Resend and fail loudly. Returns Resend's email id
 * (the id to look up in the Resend dashboard, and the one its webhooks
 * carry); throws EmailSendError when the email was not accepted.
 *
 * Resend allows a couple of requests a second by default, and a newsletter
 * loop can brush against that. A request refused for the rate limit was not
 * sent, so it is retried after a pause (twice) rather than reported as a
 * failure.
 *
 * `idempotencyKey` makes a repeat of the same request within 24 hours return
 * the first result instead of sending again: a resumed newsletter or a second
 * press of Send cannot mail anyone twice. Build it with emailIdempotencyKey.
 */
export async function sendEmail(
  apiKey: string,
  message: CreateEmailOptions,
  label: string,
  options: { idempotencyKey?: string } = {},
): Promise<string> {
  const resend = new Resend(apiKey);
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await resend.emails.send(
      message,
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    );
    if (!error && data?.id) return data.id;
    if (error?.name === "rate_limit_exceeded" && attempt < 2) {
      await sleep(1100 * (attempt + 1));
      continue;
    }
    throw new EmailSendError(
      label,
      error?.name ?? "no_response",
      error?.message ?? "no email id returned",
    );
  }
}

/**
 * An idempotency key for one email: `scope` names the recipient (an offer
 * recipient, a campaign and contact) and a digest of `content` names what
 * they are sent.
 *
 * The digest is there because Resend answers a reused key with a different
 * payload by refusing it (409) for 24 hours. A send refused for an unverified
 * From address and retried after the address is fixed is a different
 * payload, so it gets a new key and goes out; a resend of the identical email
 * keeps its key and is deduplicated.
 */
export function emailIdempotencyKey(scope: string, content: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16);
  return `${scope}-${digest}`;
}

/** The error code to record for any failure: Resend's name, or "error" for anything else. */
export function emailErrorCode(error: unknown): string {
  return error instanceof EmailSendError ? error.code : "error";
}

/**
 * The explanation to record for any failure, in an email_events row. Resend
 * sometimes quotes the address it refused; that is masked, so the row
 * explains the failure without keeping the client's address after their
 * recipient row is erased.
 */
export function emailErrorDetail(error: unknown): string {
  const text =
    error instanceof EmailSendError
      ? error.detail
      : error instanceof Error
        ? error.message
        : String(error);
  return text.replace(/[^\s<>"'`(),;:]+@[^\s<>"'`(),;:]+/g, "[address]");
}

// The failure-code words live in a module of their own, with no server-only
// imports, so client components (the shared FlashNotice) can use them too.
export { describeEmailError } from "./email-errors";
