import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { CategoryTableRow, type CategoryRow } from "@/components/category-row";

export const metadata = { title: "Categories" };

/** Derive a unique-ish code from a name, mirroring the inline add-category API. */
function codeFromName(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "CAT"
  );
}

export default async function CategoriesPage() {
  const supabase = await getSupabase();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, code, name, is_active")
    .order("name");

  // Works per category, so nothing is deleted or hidden blind.
  const { data: counts } = await supabase
    .from("pieces")
    .select("category_id")
    .is("deleted_at", null)
    .not("category_id", "is", null);
  const byCategory = new Map<string, number>();
  (counts ?? []).forEach((p) => {
    if (p.category_id) byCategory.set(p.category_id, (byCategory.get(p.category_id) ?? 0) + 1);
  });

  async function addCategory(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    // Reuse rather than duplicate — and if the match is hidden, bring it back
    // rather than creating a second category with the same name.
    const { data: existing } = await db
      .from("categories")
      .select("id, is_active")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (existing) {
      if (!existing.is_active) {
        await db.from("categories").update({ is_active: true }).eq("id", existing.id);
      }
      revalidatePath("/categories");
      return;
    }

    const requested = String(formData.get("code") ?? "").trim().toUpperCase();
    const base = requested || codeFromName(name);
    let code = base;
    for (let i = 2; i < 50; i++) {
      const { data: clash } = await db
        .from("categories")
        .select("id")
        .eq("code", code)
        .limit(1)
        .maybeSingle();
      if (!clash) break;
      code = `${base}-${i}`;
    }

    await db.from("categories").insert({ name, code, is_active: true });
    revalidatePath("/categories");
    revalidatePath("/inventory");
  }

  async function updateCategory(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!id || !name || !code) return;
    await db.from("categories").update({ name, code }).eq("id", id);
    revalidatePath("/categories");
    revalidatePath("/inventory");
  }

  /** Show/hide: keeps the category and its works, only removes it from pickers. */
  async function toggleCategory(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await db
      .from("categories")
      .update({ is_active: String(formData.get("active") ?? "") === "1" })
      .eq("id", id);
    revalidatePath("/categories");
    revalidatePath("/inventory");
  }

  /**
   * Permanent delete. A category still used by works must nominate a
   * destination; the works are moved first and the delete is abandoned if that
   * move fails, so no work is ever left without a category.
   */
  async function deleteCategory(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const mergeTo = String(formData.get("merge_to") ?? "").trim();
    if (!id || id === mergeTo) return;

    const { count } = await db
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .is("deleted_at", null);

    if ((count ?? 0) > 0) {
      if (!mergeTo) return;
      const { error } = await db
        .from("pieces")
        .update({ category_id: mergeTo })
        .eq("category_id", id);
      if (error) return;
    }
    await db.from("categories").delete().eq("id", id);
    revalidatePath("/categories");
    revalidatePath("/inventory");
  }

  const rows: CategoryRow[] = (categories ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    is_active: Boolean(c.is_active),
    pieces: byCategory.get(c.id) ?? 0,
  }));

  const active = rows.filter((r) => r.is_active).length;
  const hiddenWithWorks = rows.filter((r) => !r.is_active && r.pieces > 0);

  return (
    <div>
      <p className="text-[13px] text-ink-muted">
        Categories shown here fill the picker on a work and the Inventory filter.
        <strong className="font-medium text-ink-body"> Hide</strong> takes one out of those
        lists without touching the works that use it;{" "}
        <strong className="font-medium text-ink-body">Delete</strong> is permanent and asks
        where to move any works first.
      </p>

      <form action={addCategory} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Name
          <input
            name="name"
            required
            placeholder="Silver"
            className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]"
          />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Code <span className="normal-case tracking-normal">(optional)</span>
          <input
            name="code"
            placeholder="auto"
            className="mt-1 block w-32 rounded-lg border border-line-control bg-control px-3 py-2 font-mono text-[13.5px]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
        >
          Add category
        </button>
      </form>

      {hiddenWithWorks.length > 0 ? (
        <p className="mt-4 rounded-lg border border-warn-soft bg-warn-soft/40 px-3 py-2 text-[12.5px] text-ink-body">
          {hiddenWithWorks.length} hidden categor
          {hiddenWithWorks.length === 1 ? "y is" : "ies are"} still attached to works —{" "}
          {hiddenWithWorks
            .sort((a, b) => b.pieces - a.pieces)
            .map((c) => `${c.name} (${c.pieces})`)
            .join(", ")}
          . Those works keep the category but it can&rsquo;t be filtered for, so they are
          effectively unsorted. Re-categorise them, or Show the category again.
        </p>
      ) : null}

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
        {rows.length} categories · {active} in use
      </p>

      <div className="mt-2 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[620px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Works</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CategoryTableRow
                key={c.id}
                cat={c}
                others={rows
                  .filter((o) => o.id !== c.id)
                  .map((o) => ({ id: o.id, code: o.code, name: o.name }))}
                updateAction={updateCategory}
                toggleAction={toggleCategory}
                deleteAction={deleteCategory}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
