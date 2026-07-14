import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

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
        <table className="w-full min-w-[480px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Pieces</th>
            </tr>
          </thead>
          <tbody>
            {(locations ?? []).map((l) => (
              <tr key={l.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{l.code}</td>
                <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{l.name}</td>
                <td className="px-4 py-2.5 text-[13px] text-ink-muted">{l.type}</td>
                <td className="px-4 py-2.5">
                  <a href={`/inventory?location=${l.id}`} className="font-mono text-[12px] text-ink-mid underline">
                    {byLocation.get(l.id) ?? 0}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
