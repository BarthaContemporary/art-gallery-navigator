/**
 * The inventory table's page keys (j/k move a highlighted row, Enter opens
 * it) listen on the window, so a key pressed on a focused link or button
 * reaches them too. Enter belongs to the focused control there: a user who
 * tabbed to "Next page", a sort header or another row's title link and
 * pressed Enter meant that control, not the row j/k left highlighted.
 *
 * Plain data and a predicate, no DOM types needed, so `node --test` can
 * check it.
 */

/** Elements whose own Enter must win over "open the highlighted row". */
export const OWN_ENTER_SELECTOR =
  "a[href], button, summary, [role=button], [role=link], [role=menuitem], [role=option], [role=tab]";

/**
 * Whether Enter on this event target belongs to the target (a link, button
 * or menu item, or anything inside one) rather than to the table. A target
 * with no `closest` (the window, the document) never does.
 */
export function enterBelongsToTarget(target: unknown): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null | undefined;
  return typeof el?.closest === "function" && el.closest(OWN_ENTER_SELECTOR) != null;
}
