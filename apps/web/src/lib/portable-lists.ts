/**
 * Portable Text list items as nested lists, following each item's `level`
 * (Sanity's Tab nesting, which a schema cannot switch off). Pure and
 * import-free so `node --test` runs it; components/portable-text renders it.
 */

export interface ListItemLike {
  _key: string;
  listItem?: string;
  level?: number;
}

export interface ListNode<T extends ListItemLike> {
  /** "bullet" or "number" (whatever the item says). */
  type: string;
  /** Key for React: the first item's. */
  key: string;
  items: { block: T; children: ListNode<T>[] }[];
}

/**
 * Consecutive list blocks → a forest of lists. A deeper item opens a list
 * inside the item before it; a shallower one closes lists back to its level;
 * a change of list type at the same level starts a new list there.
 */
export function nestLists<T extends ListItemLike>(blocks: readonly T[]): ListNode<T>[] {
  const roots: ListNode<T>[] = [];
  const stack: { level: number; list: ListNode<T> }[] = [];
  for (const block of blocks) {
    const level = Math.max(1, Math.floor(block.level ?? 1));
    const type = block.listItem ?? "bullet";
    while (stack.length && (stack[stack.length - 1] as { level: number }).level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (top && top.level === level && top.list.type !== type) {
      stack.pop();
      top = stack[stack.length - 1];
    }
    if (top && top.level === level) {
      top.list.items.push({ block, children: [] });
      continue;
    }
    const list: ListNode<T> = { type, key: block._key, items: [{ block, children: [] }] };
    const parentItem = top ? top.list.items[top.list.items.length - 1] : undefined;
    if (parentItem) parentItem.children.push(list);
    else roots.push(list);
    stack.push({ level, list });
  }
  return roots;
}

/** The block style the site draws for a stored style: Heading 1 as 2, Heading 5 and 6 as 4. */
export function renderedStyle(style: string | undefined): string {
  if (style === "h1") return "h2";
  if (style === "h5" || style === "h6") return "h4";
  return style ?? "normal";
}
