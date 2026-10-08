import type { Work } from "@/lib/sanity";
import { compareByArtist } from "./artist-order";

/** The artist name a work tile shows (see `workToGrid`). */
const artistOf = (w: Work) => w.artist?.name ?? w.maker;

/**
 * Order an event's works. The editor's arrangement (`workOrder`, work ids in
 * the order chosen in the Studio) wins. Works not yet arranged follow it in
 * alphabetical order of artist, then title, then source order, so an event
 * with no arrangement reads A to Z; works without an artist close the run.
 */
export function arrangeWorks(works: Work[], workOrder: string[] | null | undefined): Work[] {
  const rank = new Map<string, number>();
  (workOrder ?? []).forEach((id, i) => {
    if (id && !rank.has(id)) rank.set(id, i);
  });
  return works
    .map((w, i) => ({ w, i, key: rank.get(w._id) }))
    .sort((a, b) => {
      if (a.key !== undefined || b.key !== undefined) {
        if (a.key === undefined) return 1;
        if (b.key === undefined) return -1;
        return a.key - b.key;
      }
      return (
        compareByArtist({ artist: artistOf(a.w), title: a.w.title }, { artist: artistOf(b.w), title: b.w.title }) ||
        a.i - b.i
      );
    })
    .map((x) => x.w);
}
