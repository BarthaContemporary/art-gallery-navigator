/**
 * Minimal ICS (RFC 5545) builder — no dependency.
 * Emits a single VEVENT with floating local times (no TZ conversion),
 * which imports cleanly into Proton Calendar, Apple Calendar and Google.
 */

export interface IcsEventInput {
  uid: string;
  /** Local start, e.g. "2026-07-20T14:00:00" or a Date. */
  start: Date | string;
  /** Local end. */
  end: Date | string;
  summary: string;
  description?: string;
  location?: string;
  organizer?: { name: string; email: string };
  attendee?: { name: string; email: string };
  url?: string;
}

/** Escape text per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "20260720T140000" — floating local time. */
function formatLocal(input: Date | string): string {
  if (typeof input === "string") {
    const digits = input.replace(/[-:]/g, "").slice(0, 15);
    // "20260720T1400" -> pad seconds
    return digits.length === 13 ? `${digits}00` : digits;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${input.getFullYear()}${pad(input.getMonth() + 1)}${pad(input.getDate())}` +
    `T${pad(input.getHours())}${pad(input.getMinutes())}${pad(input.getSeconds())}`
  );
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
    `DTSTART:${formatLocal(event.start)}`,
    `DTEND:${formatLocal(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`,
    );
  }
  if (event.attendee) {
    lines.push(
      `ATTENDEE;CN=${escapeText(event.attendee.name)};ROLE=REQ-PARTICIPANT:mailto:${event.attendee.email}`,
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n") + "\r\n";
}
