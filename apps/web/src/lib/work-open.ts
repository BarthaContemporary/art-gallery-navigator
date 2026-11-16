/**
 * "Open this work's panel": sent by the search overlay when the chosen
 * result is a work on the page already shown (`/events/<slug>?work=<id>`
 * while on /events/<slug>). Only the query string changes then, so the page
 * does not remount and WorksFoldout would not otherwise learn of it.
 * Kept apart from works-foldout so the overlay, which is on every page,
 * does not load the works grid with it.
 */
export const WORK_OPEN_EVENT = "jvb:work-open";

export function openWork(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(WORK_OPEN_EVENT, { detail: id }));
}
