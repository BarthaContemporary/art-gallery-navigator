/**
 * "Open this work's panel": sent by the search overlay when the chosen
 * result is a work on the page already shown (`/events/<slug>?work=<id>`
 * while on /events/<slug>). Only the query string changes then, so the page
 * does not remount and WorksFoldout would not otherwise learn of it.
 * Kept apart from works-foldout so the overlay, which is on every page,
 * does not load the works grid with it.
 */
export const WORK_OPEN_EVENT = "jvb:work-open";

/**
 * The work a link opens in place: its `?work=` when the link goes to the page
 * at `current` (same origin and path), else null.
 */
export function workOnThisPage(href: string, current: string): string | null {
  const here = new URL(current);
  const url = new URL(href, here);
  if (url.origin !== here.origin || url.pathname !== here.pathname) return null;
  return url.searchParams.get("work") || null;
}

/**
 * Ask the works grid on this page to open a work. True when a grid holding
 * that work took it (it cancels the event): it opens the panel, scrolls it
 * into view and writes `?work=` itself, so the caller must not navigate as
 * well (a navigation would scroll to the top and undo the centring). False
 * when no grid on the page has the work: navigate as usual.
 */
export function openWork(id: string): boolean {
  return !window.dispatchEvent(new CustomEvent<string>(WORK_OPEN_EVENT, { detail: id, cancelable: true }));
}
