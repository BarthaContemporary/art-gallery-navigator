import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";
import { LocationTableRow, type LocationRow } from "@/components/location-row";
import { LOCATION_TYPE_LABELS } from "@/lib/labels";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { FlashNotice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableFrame, Th } from "@/components/ui/table";

export const metadata = { title: "Locations" };

/**
 * Turn a Postgres error into something a dealer can act on. These writes used
 * to discard their errors entirely, so a rejected save looked identical to a
 * successful one — the row simply snapped back. A duplicate code is by far the
 * most common cause and now says so by name.
 */
function explain(error: { code?: string; message: string }, code: string): string {
  if (error.code === "23505") return `The code “${code}” is already used by another location.`;
  if (error.code === "23503") return "That location is still referenced elsewhere and can't be removed.";
  return error.message;
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();
  const session = await getSession();
  // Reordering is an admin job: it changes what everyone sees in the
  // cataloguing dropdowns, which is the whole point of it.
  const isAdmin = session ? hasRole(session.roles, "admin") : false;

  async function reorder(ids: string[]) {
    "use server";
    const s2 = await getSession();
    if (!s2 || !hasRole(s2.roles, "admin")) return;
    const db = await getSupabase();
    await persistOrder(db, "locations", ids);
    revalidatePath("/locations");
  }
  const { data: locations } = await supabase
    .from("locations")
    .select("id, code, name, type, notes")
    // Hand-set order first, code only to break ties.
    .order("sort_order")
    .order("code");

  // Works per location, across both registers — a non-JvdB work still sits on
  // a shelf, and deleting the location would strand it just the same.
  const { data: counts } = await supabase
    .from("vw_pieces_list")
    .select("location_id")
    .not("location_id", "is", null);
  const byLocation = new Map<string, number>();
  (counts ?? []).forEach((p) => {
    if (p.location_id) byLocation.set(p.location_id, (byLocation.get(p.location_id) ?? 0) + 1);
  });

  async function addLocation(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const code = String(formData.get("code") ?? "").trim();
    if (!code) redirect("/locations?error=" + encodeURIComponent("A code is required."));
    const { error } = await supabase.from("locations").insert({
      code,
      name: String(formData.get("name") ?? "").trim() || code,
      type: String(formData.get("type") ?? "storage"),
    });
    if (error) redirect("/locations?error=" + encodeURIComponent(explain(error, code)));
    revalidatePath("/locations");
    redirect("/locations");
  }

  async function updateLocation(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const code = String(formData.get("code") ?? "").trim();
    if (!id || !code) redirect("/locations?error=" + encodeURIComponent("A code is required."));
    const { error } = await db
      .from("locations")
      .update({
        code,
        name: String(formData.get("name") ?? "").trim() || code,
        type: String(formData.get("type") ?? "storage"),
      })
      .eq("id", id);
    if (error) redirect("/locations?error=" + encodeURIComponent(explain(error, code)));
    revalidatePath("/locations");
    redirect("/locations");
  }

  // Delete a location. If it still holds pieces the form supplies merge_to and
  // the pieces are moved there first (the location-history trigger records the
  // move on every piece), then the emptied location is removed.
  async function deleteLocation(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const mergeTo = String(formData.get("merge_to") ?? "").trim();
    if (!id || id === mergeTo) return;

    const { count } = await db
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("location_id", id);
    if ((count ?? 0) > 0) {
      if (!mergeTo) {
        redirect(
          "/locations?error=" +
            encodeURIComponent("Choose where to move the pieces before deleting."),
        );
      }
      for (const table of (["pieces", "external_pieces"] as const)) {
        const { error: moveError } = await db
          .from(table)
          .update({ location_id: mergeTo })
          .eq("location_id", id);
        // Don't delete if the move failed — that would orphan the pieces.
        if (moveError) {
          redirect(
            "/locations?error=" +
              encodeURIComponent(`Could not move the pieces: ${moveError.message}`),
          );
        }
      }
    }
    const { error } = await db.from("locations").delete().eq("id", id);
    if (error) redirect("/locations?error=" + encodeURIComponent(explain(error, "")));
    revalidatePath("/locations");
    redirect("/locations");
  }

  const rows: LocationRow[] = (locations ?? []).map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    type: l.type,
    pieces: byLocation.get(l.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Locations"
        meta={
          <span className="tabular">
            {formatCount(rows.length)} {rows.length === 1 ? "location" : "locations"}
          </span>
        }
      />

      <div className="space-y-6">
        <FlashNotice searchParams={sp} />

        <Section title="New location">
          <form action={addLocation} className="flex flex-wrap items-end gap-2">
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-36">
              <label htmlFor="new-location-code" className="label">
                Code
              </label>
              <input id="new-location-code" name="code" placeholder="e.g. SJ-B2" className="field tabular" />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-64">
              <label htmlFor="new-location-name" className="label">
                Name
              </label>
              <input id="new-location-name" name="name" placeholder="e.g. St James, shelf B2" className="field" />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-40">
              <label htmlFor="new-location-type" className="label">
                Type
              </label>
              <select id="new-location-type" name="type" className="field">
                {["gallery", "storage", "fair", "restorer", "consignee", "auction", "other"].map((t) => (
                  <option key={t} value={t}>{LOCATION_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" pendingLabel="Adding…">
              Add location
            </Button>
          </form>
        </Section>

        <Section
          title="All locations"
          meta={
            isAdmin
              ? "Pieces counts both registers. The order here is the order of the picker on a work: drag a grip, or focus it and use the arrow keys."
              : "Pieces counts both registers."
          }
        >
          {rows.length === 0 ? (
            <EmptyState>No locations yet. Add the first one above.</EmptyState>
          ) : (
            <TableFrame bordered>
              <Table className="min-w-[600px]">
                <thead>
                  <tr>
                    {isAdmin ? (
                      <Th className="relative w-10">
                        <span className="sr-only">Order</span>
                      </Th>
                    ) : null}
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th numeric>Pieces</Th>
                    <Th className="relative text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <ReorderGrid
                  variant="rows"
                  order={rows.map((l) => l.id)}
                  onReorder={reorder}
                  tiles={Object.fromEntries(
                    rows.map((l) => [
                      l.id,
                      <LocationTableRow
                        key={l.id}
                        loc={l}
                        reorderable={isAdmin}
                        others={rows.filter((o) => o.id !== l.id).map((o) => ({ id: o.id, code: o.code, name: o.name }))}
                        updateAction={updateLocation}
                        deleteAction={deleteLocation}
                      />,
                    ]),
                  )}
                />
              </Table>
            </TableFrame>
          )}
        </Section>
      </div>
    </div>
  );
}
