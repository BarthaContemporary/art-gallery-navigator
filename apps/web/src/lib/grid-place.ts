/**
 * Where the reader was in an archive grid (how many tiles were revealed and
 * the scroll offset), kept per page in sessionStorage so that Back restores
 * it. Pure helpers, kept apart from the component so node --test can load
 * them.
 *
 * The key names the page the grid belongs to, and it is fixed when the grid
 * mounts. It must not be read from the address bar when the save runs: on an
 * in-app navigation the grid's unmount cleanup runs after Next has already
 * pushed the destination URL, so a key read at that moment would file the
 * home archive's place under the event page just opened, and Back to the
 * home page would find nothing (and a grid on another page could overwrite
 * the home page's place).
 */

export type GridPlace = { visible: number; y: number };

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem">;

/** The storage key for the grid on the page at `pathname`. */
export function gridPlaceKey(pathname: string): string {
  return `infinite-grid:${pathname}`;
}

/** The place saved under `key`, or null when there is none or it cannot be read. */
export function readGridPlace(store: ReadStore | null | undefined, key: string): GridPlace | null {
  try {
    const raw = store?.getItem(key);
    const v = raw ? (JSON.parse(raw) as Partial<GridPlace> | null) : null;
    return v && typeof v.visible === "number" && typeof v.y === "number" && Number.isFinite(v.visible) && Number.isFinite(v.y)
      ? { visible: v.visible, y: v.y }
      : null;
  } catch {
    return null; // private mode, blocked storage, a damaged value
  }
}

/** Save `place` under `key`; storage that is unavailable is ignored (the grid starts afresh next time). */
export function writeGridPlace(store: WriteStore | null | undefined, key: string, place: GridPlace): void {
  try {
    store?.setItem(key, JSON.stringify(place));
  } catch {
    // storage unavailable or full
  }
}

/**
 * A save function bound to the page the grid mounted on: `key` is taken
 * once, by the caller, at mount, and every later call (pagehide, the unmount
 * cleanup) writes under that same key whatever the address bar says by then.
 * `store` is a getter because reading window.sessionStorage itself throws
 * where site data is blocked.
 */
export function gridPlaceSaver(
  key: string,
  current: () => GridPlace,
  store: () => WriteStore | null | undefined,
): () => void {
  return () => {
    let s: WriteStore | null | undefined;
    try {
      s = store();
    } catch {
      return;
    }
    writeGridPlace(s, key, current());
  };
}
