import type { UserRole } from "@jvb/db";

/**
 * Who may use the shared gallery calendar: read it, and create, change or
 * delete its events.
 *
 * The calendar lives on Radicale, outside the database, and the studio
 * reaches it with the gallery's own CalDAV account (lib/caldav.ts), so no
 * database policy stands between a signed-in user and its contents. Its
 * events name clients, addresses and visits, which is CRM data: the same
 * roles as the appointments table (admin and staff), never the accountant.
 * Every page, panel and server action that reaches the calendar checks this
 * first.
 */
export const CALENDAR_ROLES = ["admin", "staff"] as const satisfies readonly UserRole[];

export function canUseCalendar(roles: readonly UserRole[]): boolean {
  return CALENDAR_ROLES.some((r) => roles.includes(r));
}
