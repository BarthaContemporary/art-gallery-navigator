import { useEffect, useMemo, useState } from "react";
import { Badge, Box, Card, Flex, Spinner, Stack, Text, TextInput } from "@sanity/ui";
import { useClient } from "sanity";
import { useRouter } from "sanity/router";

/**
 * "Catalogue" — one flat, searchable list of every historical work across all
 * exhibitions. The entries themselves stay where they are stored (inside each
 * exhibition's `catalogue` array); clicking a row opens that exhibition with
 * the entry focused. This is a browsing aid, not a second copy.
 */

type Row = {
  key: string;
  exhibitionId: string;
  exhibitionTitle: string;
  exhibitionOrder: number;
  order: number;
  reference: string | null;
  title: string | null;
  maker: string | null;
  makerDates: string | null;
  medium: string | null;
  originAndDate: string | null;
  dimensions: string | null;
  sold: boolean | null;
  imageRef: string | null;
};

type FetchedEntry = { _key: string } & Partial<
  Pick<Row, "reference" | "title" | "maker" | "makerDates" | "medium" | "originAndDate" | "dimensions" | "sold" | "imageRef">
>;
type FetchedExhibition = { _id: string; title: string | null; catalogue: FetchedEntry[] | null };

const QUERY = `*[_type == "exhibition" && defined(catalogue)]
  | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc) {
    _id, title,
    catalogue[]{ _key, reference, title, maker, makerDates, medium, originAndDate, dimensions, sold, "imageRef": image.asset._ref }
  }`;

function thumb(ref: string | null, projectId: string, dataset: string): string | null {
  const m = ref && /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
  if (!m) return null;
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${m[1]}-${m[2]}.${m[3]}?w=96&h=96&fit=crop&auto=format`;
}

export function CatalogueBrowser() {
  const client = useClient({ apiVersion: "2026-07-01" });
  const router = useRouter();
  const { projectId = "dql8z4kv", dataset = "production" } = client.config();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    client
      .fetch<FetchedExhibition[]>(QUERY)
      .then((exhibitions) => {
        if (cancelled) return;
        const out: Row[] = [];
        exhibitions.forEach((e, ei) => {
          (e.catalogue ?? []).forEach((c, ci) => {
            out.push({
              key: c._key,
              exhibitionId: e._id,
              exhibitionTitle: e.title ?? "Untitled exhibition",
              exhibitionOrder: ei,
              order: ci,
              reference: c.reference ?? null,
              title: c.title ?? null,
              maker: c.maker ?? null,
              makerDates: c.makerDates ?? null,
              medium: c.medium ?? null,
              originAndDate: c.originAndDate ?? null,
              dimensions: c.dimensions ?? null,
              sold: c.sold ?? null,
              imageRef: c.imageRef ?? null,
            });
          });
        });
        setRows(out);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [client]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return rows;
    return rows.filter((r) => {
      const hay = [r.reference, r.title, r.maker, r.medium, r.originAndDate, r.exhibitionTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q]);

  function open(row: Row) {
    // Deep-link into the exhibition with this entry focused.
    router.navigateIntent("edit", {
      id: row.exhibitionId,
      type: "exhibition",
      path: `catalogue[_key=="${row.key}"]`,
    });
  }

  return (
    <Flex direction="column" height="fill">
      <Card padding={3} borderBottom>
        <Stack space={3}>
          <TextInput
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search reference, maker, title, medium, exhibition…"
            fontSize={2}
            padding={3}
          />
          <Text size={1} muted>
            {rows
              ? `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} works across all exhibitions. Click a row to edit it in its exhibition.`
              : "Loading…"}
          </Text>
        </Stack>
      </Card>
      <Box flex={1} overflow="auto">
        {error ? (
          <Card padding={4} tone="critical">
            <Text>Could not load the catalogue: {error}</Text>
          </Card>
        ) : !rows ? (
          <Flex padding={5} justify="center">
            <Spinner />
          </Flex>
        ) : (
          <Stack>
            {filtered.slice(0, 500).map((r) => {
              const src = thumb(r.imageRef, projectId, dataset);
              const makerLine = r.maker ? (r.makerDates ? `${r.maker} (${r.makerDates})` : r.maker) : null;
              return (
                <Card
                  key={`${r.exhibitionId}:${r.key}`}
                  as="button"
                  padding={3}
                  borderBottom
                  onClick={() => open(r)}
                  style={{ textAlign: "left", width: "100%", cursor: "pointer" }}
                >
                  <Flex align="center" gap={3}>
                    <Box style={{ width: 48, height: 48, flexShrink: 0, background: "var(--card-border-color)", overflow: "hidden" }}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" width={48} height={48} style={{ display: "block", objectFit: "cover" }} />
                      ) : null}
                    </Box>
                    <Stack space={2} flex={1}>
                      <Flex align="center" gap={2}>
                        {r.reference ? <Badge mode="outline">{r.reference}</Badge> : null}
                        <Text size={1} weight="medium">
                          {makerLine ?? r.title ?? "Untitled"}
                        </Text>
                        {r.sold ? <Badge tone="caution">Sold</Badge> : null}
                      </Flex>
                      <Text size={1} muted>
                        {[makerLine ? r.title : null, r.medium, r.originAndDate, r.dimensions].filter(Boolean).join(" · ") || "No details on record"}
                      </Text>
                      <Text size={0} muted>
                        {r.exhibitionTitle}
                      </Text>
                    </Stack>
                  </Flex>
                </Card>
              );
            })}
            {filtered.length > 500 ? (
              <Card padding={3}>
                <Text size={1} muted>
                  Showing the first 500 — narrow the search to see the rest.
                </Text>
              </Card>
            ) : null}
          </Stack>
        )}
      </Box>
    </Flex>
  );
}
