import { useCallback, useState } from "react";
import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { set, useClient, useFormValue, type ArrayOfObjectsInputProps } from "sanity";

type Ref = { _type: "reference"; _ref: string; _key: string; _weak?: boolean };

/**
 * The order in which an event shows its works, across every source: the
 * works chosen by hand and every attached inventory list. "Collect works"
 * appends any work not yet in the order (hand-picked first, then each list in
 * list order); drag the rows to arrange them. Works no longer in any source
 * are dropped on the next collect. The site follows this order and appends
 * anything new that has not been collected yet.
 */
export function WorkOrderInput(props: ArrayOfObjectsInputProps) {
  const client = useClient({ apiVersion: "2026-07-01" });
  const works = (useFormValue(["works"]) as Ref[] | undefined) ?? [];
  const lists = (useFormValue(["workLists"]) as Ref[] | undefined) ?? [];
  const current = (props.value as Ref[] | undefined) ?? [];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const collect = useCallback(async () => {
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
      const added = sourceIds.filter((id) => !keptIds.has(id));
      const next: Ref[] = [
        ...kept,
        ...added.map((id) => ({ _type: "reference" as const, _ref: id, _key: id.replace(/^work-/, "").replace(/-/g, "").slice(0, 12), _weak: true })),
      ];
      props.onChange(set(next));
      const dropped = current.length - kept.length;
      setNote(
        `${added.length} added${dropped ? `, ${dropped} removed (no longer in any source)` : ""}. ${next.length} in order.`,
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
          <Button text={busy ? "Collecting…" : "Collect works from the fields above"} tone="primary" disabled={busy} onClick={collect} />
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
