import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { LocationTableRow, type LocationRow } from "@/components/location-row";

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
  const { data: locations } = await supabase
    .from("locations")
    .select("id, code, name, type, notes")
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
      {sp.error ? (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {sp.error}
        </p>
      ) : null}
      <form action={addLocation} className="flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Code
          <input name="code" placeholder="SJ-B2" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Name
          <input name="name" placeholder="St James, shelf B2" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Type
          <select name="type" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]">
            {["gallery", "storage", "fair", "restorer", "consignee", "auction", "other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
          Add location
        </button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[560px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Pieces</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <LocationTableRow
                key={l.id}
                loc={l}
                others={rows.filter((o) => o.id !== l.id).map((o) => ({ id: o.id, code: o.code, name: o.name }))}
                updateAction={updateLocation}
                deleteAction={deleteLocation}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
