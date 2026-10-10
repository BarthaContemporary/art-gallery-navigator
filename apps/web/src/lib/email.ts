import { Resend, type CreateEmailOptions } from "resend";

/**
 * Send one email through Resend and fail loudly. The SDK reports a rejected
 * send (unverified sender, bad address, invalid key, rate limit) as a
 * returned `error` rather than throwing, so a caller that only awaits the
 * call never learns the email was not sent. This throws instead, with the
 * caller's label, and returns Resend's email id on success (the id to look
 * up in the Resend dashboard).
 */
export async function sendEmail(apiKey: string, message: CreateEmailOptions, label: string): Promise<string> {
  const { data, error } = await new Resend(apiKey).emails.send(message);
  if (error || !data) {
    throw new Error(`${label}: Resend refused the email (${error?.name ?? "no response"}: ${error?.message ?? "no email id returned"})`);
  }
  return data.id;
}

/** An address shortened for logs: first letter and domain, e.g. j…@example.com. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at > 0 ? `${address[0]}…${address.slice(at)}` : "…";
}

/**
 * Where the website sends staff notifications: GALLERY_NOTIFICATIONS_EMAIL,
 * or the gallery's own address from the site settings when that is unset or
 * blank.
 */
export function galleryNotificationAddress(settingsEmail: string | null | undefined): string | null {
  return process.env.GALLERY_NOTIFICATIONS_EMAIL?.trim() || settingsEmail?.trim() || null;
}
