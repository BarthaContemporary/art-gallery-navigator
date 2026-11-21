import { getSession, getSupabase } from "@/lib/supabase";
import { sanitizeFilterTerm } from "@/lib/search";
import { selectInChunks } from "@/lib/chunk";
import { inOrder, searchMakerIds } from "@/lib/opensearch/search";
import { MakerRow, type Maker } from "@/components/maker-row";
import { addMaker, deleteMaker } from "./actions";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyRow, Table, TableFrame, Th } from "@/components/ui/table";

export const metadata = { title: "Makers" };

const MAKER_COLUMNS = "id, display_name, native_name, life_dates, region, school_or_workshop, web_visible";
/** Every match the page can show: PostgREST's row cap. */
const SEARCH_LIMIT = 1000;
/** A page's wait for OpenSearch (lib/opensearch/search). */
const SEARCH_TIMEOUT_MS = 1500;

export default async function MakersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { q: rawQ, error } = await searchParams;
  const typed = (rawQ ?? "").trim();
  const q = sanitizeFilterTerm(typed);
  const supabase = await getSupabase();

  // A search goes through searchMakerIds: Postgres's ILIKE over the names,
  // region and school (alphabetical, as before) always, with OpenSearch's
  // folded and typo-tolerant matches first for admin and staff ("yosai"
  // finding Yōsai). Its ids are only ids: the rows come from the makers
  // table through this client, in the search's order.
  let list: Maker[] = [];
  let similar = false;
  let readError: string | null = null;
  if (q) {
    const session = await getSession();
    const found = await searchMakerIds(supabase, typed, {
      roles: session?.roles ?? [],
      limit: SEARCH_LIMIT,
      timeoutMs: SEARCH_TIMEOUT_MS,
      fuzzy: true,
    });
    if (found.error) {
      readError = found.error.message;
    } else {
      try {
        const rows = await selectInChunks<Maker>(found.ids, (chunk) =>
          supabase.from("makers").select(MAKER_COLUMNS).in("id", chunk),
        );
        list = inOrder(found.ids, rows);
        similar = found.similar && list.length > 0;
      } catch (e) {
        readError = e instanceof Error ? e.message : "Could not read the makers";
      }
    }
  } else {
    const { data: makers, error: listError } = await supabase.from("makers").select(MAKER_COLUMNS).order("display_name");
    if (listError) readError = listError.message;
    list = (makers ?? []) as Maker[];
  }

  const onSite = list.filter((m) => m.web_visible).length;

  return (
    <div>
      <PageHeader
        title="Makers"
        meta={
          <span className="tabular">
            {q
              ? `${formatCount(list.length)} ${list.length === 1 ? "maker" : "makers"} matching “${q}”`
              : `${formatCount(list.length)} ${list.length === 1 ? "maker" : "makers"} · ${formatCount(onSite)} on the website`}
          </span>
        }
      />

      <div className="space-y-6">
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Section title="New maker">
          <form action={addMaker} className="flex flex-wrap items-end gap-2">
            {[
              ["display_name", "Name (romanized)", "Kobayashi Shōmin"],
              ["native_name", "Native name", "小林紹民"],
              ["life_dates", "Life dates", "1912–1994"],
              ["region", "Region", "Japan"],
            ].map(([name, label, ph]) => (
              <div key={name} className="flex w-full min-w-0 flex-col gap-1 sm:w-48">
                <label htmlFor={`new-maker-${name}`} className="label">
                  {label}
                </label>
                <input
                  id={`new-maker-${name}`}
                  name={name}
                  placeholder={`e.g. ${ph}`}
                  lang={name === "native_name" ? "ja" : undefined}
                  className="field"
                />
              </div>
            ))}
            <Button type="submit" variant="primary" pendingLabel="Adding…">
              Add maker
            </Button>
          </form>
        </Section>

        <Section
          title="All makers"
          meta="Every maker has an artist page on the website unless switched off here. Changes reach the site within a minute."
        >
          <form method="get" role="search" className="mb-3 flex max-w-[34rem] flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="makers-q" className="label">
                Search makers
              </label>
              <input
                id="makers-q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Name, native name, region or school"
                className="field"
              />
            </div>
            <Button type="submit">Search</Button>
            {q ? (
              <ButtonLink href="/makers" variant="quiet">
                Clear
              </ButtonLink>
            ) : null}
          </form>

          {readError ? (
            <Notice tone="danger" className="mb-3">
              Could not load the makers: {readError}
            </Notice>
          ) : null}
          {similar ? (
            <Notice className="mb-3">No exact matches for “{q}”. Showing similar makers.</Notice>
          ) : null}

          <TableFrame bordered>
            {/* 8px cell sides and wrapping dates and heads, so the whole row,
                Edit and Delete included, fits the 768 tablet width as it did;
                narrower, the frame scrolls sideways. */}
            <Table className="min-w-[640px] [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Native</Th>
                  <Th>Dates</Th>
                  <Th>Region</Th>
                  <Th>
                    <span className="inline-block whitespace-normal">School or workshop</span>
                  </Th>
                  <Th>Website</Th>
                  <Th className="relative text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <MakerRow key={m.id} maker={m} deleteAction={deleteMaker} />
                ))}
                {list.length === 0 && !readError ? (
                  <EmptyRow
                    colSpan={7}
                    action={
                      q ? (
                        <ButtonLink href="/makers" size="sm">
                          Clear the search
                        </ButtonLink>
                      ) : undefined
                    }
                  >
                    {q ? "No makers match your search." : "No makers yet. Add the first one above."}
                  </EmptyRow>
                ) : null}
              </tbody>
            </Table>
          </TableFrame>
        </Section>
      </div>
    </div>
  );
}
