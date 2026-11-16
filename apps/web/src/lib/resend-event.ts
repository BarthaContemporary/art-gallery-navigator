/**
 * What a Resend webhook event changes, worked out without touching the
 * database (api/resend-webhook applies it). Import-free so `node --test`
 * runs it directly.
 */

export type ResendEvent = {
  type?: string;
  data?: { email_id?: string; bounce?: { type?: string }; created_at?: string } & Record<string, unknown>;
  created_at?: string;
};

const FIELD_BY_TYPE: Record<string, "opened_at" | "clicked_at" | "bounced_at"> = {
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "bounced_at",
};

export interface ResendEventPlan {
  /** The event's own time, so a redelivered event writes the same values. */
  at: string;
  /** Patch for the campaign recipient row, or null when the event does not touch it. */
  recipientPatch: Record<string, unknown> | null;
  /** Patch for the contact: a spam complaint or a permanent bounce. */
  suppression: Record<string, unknown> | null;
}

export function planResendEvent(event: ResendEvent, now: Date = new Date()): ResendEventPlan {
  const type = event.type ?? "";
  const at = event.created_at ?? now.toISOString();
  const field = FIELD_BY_TYPE[type];

  let recipientPatch: Record<string, unknown> | null = null;
  if (field) {
    recipientPatch = { [field]: at };
    if (field === "bounced_at") recipientPatch.status = "bounced";
    else if (type === "email.opened") recipientPatch.status = "opened";
    else if (type === "email.clicked") recipientPatch.status = "clicked";
  }

  // A spam complaint is a withdrawal of consent (PECR reg. 22); a permanent
  // bounce means the address is dead. Both stop further marketing to the
  // contact, whichever campaign or offer the email belonged to.
  let suppression: Record<string, unknown> | null = null;
  if (type === "email.complained") {
    suppression = { marketing_consent: false, unsubscribed_at: at, do_not_mail: true };
  } else if (type === "email.bounced" && !/transient|soft/i.test(event.data?.bounce?.type ?? "")) {
    suppression = { email_bounced_at: at, do_not_mail: true };
  }

  return { at, recipientPatch, suppression };
}
