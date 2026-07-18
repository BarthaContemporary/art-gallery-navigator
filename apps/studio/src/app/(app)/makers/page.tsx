import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { sanitizeFilterTerm } from "@/lib/search";
import { MakerRow } from "@/components/maker-row";

export const metadata = { title: "Makers" };

export default async function MakersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = sanitizeFilterTerm((rawQ ?? "").trim());
  const supabase = await getSupabase();
  let query = supabase
    .from("makers")
    .select("id, display_name, native_name, life_dates, region, school_or_workshop")
    .order("display_name");
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `display_name.ilike.${like}`,
        `native_name.ilike.${like}`,
        `romanized_name.ilike.${like}`,
        `region.ilike.${like}`,
        `school_or_workshop.ilike.${like}`,
      ].join(","),
    );
  }
  const { data: makers } = await query;

  const nullable = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;

  async function addMaker(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const display_name = String(formData.get("display_name") ?? "").trim();
    if (!display_name) return;
    await supabase.from("makers").insert({
      display_name,
      native_name: nullable(formData, "native_name"),
      life_dates: nullable(formData, "life_dates"),
      region: nullable(formData, "region"),
    });
    revalidatePath("/makers");
  }

  async function updateMaker(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const display_name = String(formData.get("display_name") ?? "").trim();
    if (!id || !display_name) return;
    await supabase
      .from("makers")
      .update({
        display_name,
        native_name: nullable(formData, "native_name"),
        life_dates: nullable(formData, "life_dates"),
        region: nullable(formData, "region"),
        school_or_workshop: nullable(formData, "school_or_workshop"),
      })
      .eq("id", id);
    revalidatePath("/makers");
    revalidatePath("/inventory");
  }

  async function deleteMaker(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    // pieces.maker_id is ON DELETE SET NULL, so works are unlinked, not removed.
    await supabase.from("makers").delete().eq("id", id);
    revalidatePath("/makers");
    revalidatePath("/inventory");
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

      <form method="get" className="mt-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search makers — name, native name, region, school…"
          className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body sm:w-96"
        />
        <button type="submit" className="rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] font-medium text-ink-mid">
          Search
        </button>
        {q ? (
          <a href="/makers" className="text-[12.5px] text-oranje">
            Clear
          </a>
        ) : null}
      </form>
      {q ? (
        <p className="mt-2 text-[12px] text-ink-soft">
          {(makers ?? []).length} maker{(makers ?? []).length === 1 ? "" : "s"} matching “{q}”.
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[560px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Native</th>
              <th className="px-4 py-2.5 font-medium">Dates</th>
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">School / workshop</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(makers ?? []).map((m) => (
              <MakerRow
                key={m.id}
                maker={m}
                updateAction={updateMaker}
                deleteAction={deleteMaker}
              />
            ))}
            {(makers ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-ink-soft">
                  {q ? "No makers match your search." : "No makers yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
