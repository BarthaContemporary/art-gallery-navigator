import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Makers" };

export default async function MakersPage() {
  const supabase = await getSupabase();
  const { data: makers } = await supabase
    .from("makers")
    .select("id, display_name, native_name, life_dates, region, school_or_workshop")
    .order("display_name");

  async function addMaker(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const display_name = String(formData.get("display_name") ?? "").trim();
    if (!display_name) return;
    await supabase.from("makers").insert({
      display_name,
      native_name: String(formData.get("native_name") ?? "").trim() || null,
      life_dates: String(formData.get("life_dates") ?? "").trim() || null,
      region: String(formData.get("region") ?? "").trim() || null,
    });
    revalidatePath("/makers");
  }

  return (
    <div>
      <form action={addMaker} className="flex flex-wrap items-end gap-2">
        {[
          ["display_name", "Name (romanized)", "Kobayashi Shōmin"],
          ["native_name", "Native name", "小林紹民"],
          ["life_dates", "Life dates", "1912–1994"],
          ["region", "Region", "Japan"],
        ].map(([name, label, ph]) => (
          <label key={name} className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            {label}
            <input name={name} placeholder={ph} className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
          </label>
        ))}
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
          Add maker
        </button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[560px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Native</th>
              <th className="px-4 py-2.5 font-medium">Dates</th>
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">School / workshop</th>
            </tr>
          </thead>
          <tbody>
            {(makers ?? []).map((m) => (
              <tr key={m.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{m.display_name}</td>
                <td className="px-4 py-2.5 text-[13.5px] text-ink-muted">{m.native_name ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">{m.life_dates ?? "—"}</td>
                <td className="px-4 py-2.5 text-[13px] text-ink-muted">{m.region ?? "—"}</td>
                <td className="px-4 py-2.5 text-[13px] text-ink-muted">{m.school_or_workshop ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
