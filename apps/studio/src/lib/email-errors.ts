/**
 * Plain data and string helpers about email failures, with no imports, so a
 * client component can use them as well as the server-side senders in
 * lib/email.ts (which re-exports describeEmailError for older imports).
 */

/**
 * A few words for a failure code, for the banner after a send ("3 failed
 * (rate limit)"). Codes are Resend's fixed error names, so they are safe to
 * carry in a URL; the full message is kept in email_events.
 */
export function describeEmailError(code: string | null | undefined): string {
  switch (code) {
    case "rate_limit_exceeded":
      return "rate limit";
    case "invalid_from_address":
      return "From address refused";
    case "validation_error":
      return "sender or address refused";
    case "missing_api_key":
    case "invalid_api_Key":
    case "invalid_access":
      return "API key refused";
    case "no_response":
    case "application_error":
    case "internal_server_error":
      return "Resend did not answer";
    case "invalid_idempotent_request":
    case "concurrent_idempotent_requests":
      return "already being sent";
    case null:
    case undefined:
    case "":
      return "unknown error";
    default:
      return code.replace(/_/g, " ");
  }
}
