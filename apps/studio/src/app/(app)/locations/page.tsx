import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { LocationTableRow, type LocationRow } from "@/components/location-row";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const supabase = await getSupabase();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, code, name, type, notes")
    .order("code");

  // pieces per location
  const { data: counts } = await supabase
    .from("pieces")
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
    if (!code) return;
    await supabase.from("locations").insert({
      code,
      name: String(formData.get("name") ?? "").trim() || code,
      type: String(formData.get("type") ?? "storage"),
    });
    revalidatePath("/locations");
  }

  async function updateLocation(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const code = String(formData.get("code") ?? "").trim();
    if (!id || !code) return;
    await db
      .from("locations")
      .update({
        code,
        name: String(formData.get("name") ?? "").trim() || code,
        type: String(formData.get("type") ?? "storage"),
      })
      .eq("id", id);
    revalidatePath("/locations");
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
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .eq("location_id", id);
    if ((count ?? 0) > 0) {
      if (!mergeTo) return; // still occupied and no target chosen — refuse
      const { error: moveError } = await db
        .from("pieces")
        .update({ location_id: mergeTo })
        .eq("location_id", id);
      if (moveError) return; // don't delete if the move failed
    }
    await db.from("locations").delete().eq("id", id);
    revalidatePath("/locations");
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
