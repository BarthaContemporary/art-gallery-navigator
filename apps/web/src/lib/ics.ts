/**
 * Minimal ICS (RFC 5545) builder — no dependency.
 * Emits a single VEVENT. Give start and end as Dates (real instants), and
 * they are written in UTC ("…Z"), so a calendar in any time zone shows the
 * right hour; a string is written as a floating local time, which a
 * calendar reads in its own zone. Imports cleanly into Proton Calendar,
 * Apple Calendar, Google and Outlook.
 */

export interface IcsEventInput {
  uid: string;
  /** The start: a Date (written in UTC), or a floating local time such as "2026-07-20T14:00:00". */
  start: Date | string;
  /** The end, in the same form. */
  end: Date | string;
  summary: string;
  description?: string;
  location?: string;
  organizer?: { name: string; email: string };
  /** The name is left out when there is none safe to show (a booking's typed name). */
  attendee?: { name?: string | null; email: string };
  url?: string;
  /** VEVENT STATUS: TENTATIVE for a request nobody has confirmed yet. Default CONFIRMED. */
  status?: "CONFIRMED" | "TENTATIVE";
}

/**
 * Escape text per RFC 5545 §3.3.11. Every line break, a lone CR included,
 * becomes "\n", so text from a form can never end the property and start
 * one of its own; other control characters, which a calendar's TEXT may not
 * hold, are dropped.
 */
function escapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * A parameter value such as a CN, as a quoted string (RFC 5545 §3.2), where
 * ";", ":" and "," are plain characters; the double quotes and control
 * characters a quoted value may not hold are dropped.
 */
function paramValue(value: string): string {
  return `"${value.replace(/["\u0000-\u001f\u007f]/g, "")}"`;
}

/**
 * A DTSTART / DTEND value: "20260720T130000Z" for a Date (the instant, in
 * UTC), "20260720T140000" for a string (floating local time).
 */
function formatDateTime(input: Date | string): string {
  if (typeof input === "string") {
    const digits = input.replace(/[-:]/g, "").slice(0, 15);
    // "20260720T1400" -> pad seconds
    return digits.length === 13 ? `${digits}00` : digits;
  }
  return formatUtc(input);
}

/** "20260713T101500Z" — UTC stamp for DTSTAMP. */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export function buildIcs(event: IcsEventInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JVB//Web Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatDateTime(event.start)}`,
    `DTEND:${formatDateTime(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${paramValue(event.organizer.name)}:mailto:${event.organizer.email}`,
    );
  }
  if (event.attendee) {
    const cn = event.attendee.name ? `;CN=${paramValue(event.attendee.name)}` : "";
    lines.push(`ATTENDEE${cn};ROLE=REQ-PARTICIPANT:mailto:${event.attendee.email}`);
  }

  lines.push(`STATUS:${event.status === "TENTATIVE" ? "TENTATIVE" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n") + "\r\n";
}
