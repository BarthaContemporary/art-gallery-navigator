import { useCallback, useState } from "react";
import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { set, useClient, useFormValue, type ArrayOfObjectsInputProps } from "sanity";
import { compareByArtist } from "../../src/lib/artist-order";

type Ref = { _type: "reference"; _ref: string; _key: string; _weak?: boolean };

/**
 * The order in which an event shows its works, across every source: the
 * works chosen by hand and every attached inventory list. "Collect works"
 * appends any work not yet in the order, A to Z by artist (then title), so a
 * collect without dragging already matches what the page shows for works it
 * has no order for; drag the rows to arrange them. "Sort all A to Z by
 * artist" collects and then rewrites the whole order alphabetically, the way
 * to undo an arrangement. Works no longer in any source are dropped on the
 * next collect. The site follows this order and shows anything not yet
 * collected after it, again A to Z by artist.
 */
export function WorkOrderInput(props: ArrayOfObjectsInputProps) {
  const client = useClient({ apiVersion: "2026-07-01" });
  const works = (useFormValue(["works"]) as Ref[] | undefined) ?? [];
  const lists = (useFormValue(["workLists"]) as Ref[] | undefined) ?? [];
  const current = (props.value as Ref[] | undefined) ?? [];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Gathers every work from the fields above. With `sortAll`, the whole order
  // is rewritten A to Z by artist; otherwise only the newly collected works
  // arrive A to Z and the rows already arranged keep their places.
  const collect = useCallback(async (sortAll: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      const listIds = lists.map((l) => l._ref).filter(Boolean);
      const listDocs: { _id: string; works?: Ref[] }[] = listIds.length
        ? await client.fetch(`*[_type == "workList" && _id in $ids]{ _id, works }`, { ids: listIds })
        : [];
      const byId = new Map(listDocs.map((d) => [d._id, d.works ?? []]));
      const sourceIds: string[] = [];
      const seen = new Set<string>();
      const push = (id?: string) => {
        if (id && !seen.has(id)) {
          seen.add(id);
          sourceIds.push(id);
        }
      };
      works.forEach((w) => push(w._ref));
      listIds.forEach((id) => (byId.get(id) ?? []).forEach((w) => push(w._ref)));

      const kept = current.filter((r) => seen.has(r._ref));
      const keptIds = new Set(kept.map((r) => r._ref));
      const addedIds = sourceIds.filter((id) => !keptIds.has(id));
      // The new rows arrive A to Z by artist, the same rule the page applies
      // to works it has no order for, so the Studio and the site agree.
      const named: { _id: string; artist: string | null; title: string | null }[] = addedIds.length
        ? await client.fetch(
            `*[_type == "work" && _id in $ids]{ _id, "artist": coalesce(artist->name, maker), title }`,
            { ids: addedIds },
          )
        : [];
      const nameOf = new Map(named.map((n) => [n._id, n]));
      const added = addedIds
        .map((id, i) => ({ id, i, ...(nameOf.get(id) ?? { artist: null, title: null }) }))
        .sort((a, b) => compareByArtist(a, b) || a.i - b.i)
        .map((x) => x.id);
      const toRef = (id: string): Ref => ({
        _type: "reference",
        _ref: id,
        _key: id.replace(/^work-/, "").replace(/-/g, "").slice(0, 12),
        _weak: true,
      });
      const next: Ref[] = [...kept, ...added.map(toRef)];
      const dropped = current.length - kept.length;
      if (sortAll) {
        const all: { _id: string; artist: string | null; title: string | null }[] = await client.fetch(
          `*[_type == "work" && _id in $ids]{ _id, "artist": coalesce(artist->name, maker), title }`,
          { ids: next.map((r) => r._ref) },
        );
        const info = new Map(all.map((n) => [n._id, n]));
        const sorted = next
          .map((r, i) => ({ r, i, ...(info.get(r._ref) ?? { artist: null, title: null }) }))
          .sort((a, b) => compareByArtist(a, b) || a.i - b.i)
          .map((x) => x.r);
        props.onChange(set(sorted));
        setNote(
          `All ${sorted.length} works sorted A to Z by artist${added.length ? ` (${added.length} newly collected)` : ""}${dropped ? `, ${dropped} removed (no longer in any source)` : ""}.`,
        );
        return;
      }
      props.onChange(set(next));
      setNote(
        `${added.length} added A to Z by artist${dropped ? `, ${dropped} removed (no longer in any source)` : ""}. ${next.length} in order.`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not collect works");
    } finally {
      setBusy(false);
    }
  }, [client, works, lists, current, props]);

  return (
    <Stack space={3}>
      <Card padding={3} radius={2} tone="transparent" border>
        <Flex align="center" gap={3} wrap="wrap">
          <Button text={busy ? "Working…" : "Collect works from the fields above"} tone="primary" disabled={busy} onClick={() => collect(false)} />
          <Button text="Sort all A to Z by artist" mode="ghost" disabled={busy} onClick={() => collect(true)} />
          <Text size={1} muted>
            {works.length} chosen by hand · {lists.length} list{lists.length === 1 ? "" : "s"} · {current.length} in order
          </Text>
        </Flex>
        {note ? (
          <Text size={1} muted style={{ marginTop: 8 }}>
            {note}
          </Text>
        ) : null}
      </Card>
      {props.renderDefault(props)}
    </Stack>
  );
}
