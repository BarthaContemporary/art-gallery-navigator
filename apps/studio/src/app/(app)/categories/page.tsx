import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";
import { CategoryTableRow, type CategoryRow } from "@/components/category-row";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { FlashNotice, Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableFrame, Th } from "@/components/ui/table";

export const metadata = { title: "Categories" };

/** Report failures rather than swallowing them — see the Locations page note. */
function explain(error: { code?: string; message: string }, code: string): string {
  if (error.code === "23505") return `The code “${code}” is already used by another category.`;
  return error.message;
}
const fail = (msg: string) => redirect("/categories?error=" + encodeURIComponent(msg));

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

export default async function CategoriesPage({
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
    await persistOrder(db, "categories", ids);
    revalidatePath("/categories");
  }
  const { data: categories } = await supabase
    .from("categories")
    .select("id, code, name, is_active")
    // Hand-set order first, name only to break ties.
    .order("sort_order")
    .order("name");

  // Works per category across both registers, so nothing is deleted or hidden
  // blind.
  const { data: counts } = await supabase
    .from("vw_pieces_list")
    .select("category_id")
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

    const { error } = await db.from("categories").insert({ name, code, is_active: true });
    if (error) fail(explain(error, code));
    revalidatePath("/categories");
    revalidatePath("/inventory");
  }

  async function updateCategory(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!id || !name || !code) fail("A name and code are both required.");
    const { error } = await db.from("categories").update({ name, code }).eq("id", id);
    if (error) fail(explain(error, code));
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
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if ((count ?? 0) > 0) {
      if (!mergeTo) fail("Choose where to move the works before deleting.");
      for (const table of (["pieces", "external_pieces"] as const)) {
        const { error: moveError } = await db
          .from(table)
          .update({ category_id: mergeTo })
          .eq("category_id", id);
        if (moveError) fail(`Could not move the works: ${moveError.message}`);
      }
    }
    const { error } = await db.from("categories").delete().eq("id", id);
    if (error) fail(explain(error, ""));
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
      <PageHeader
        title="Categories"
        meta={<span className="tabular">{`${formatCount(rows.length)} categories · ${formatCount(active)} in use`}</span>}
      >
        <p className="max-w-[var(--jvb-measure)] text-[13px] leading-[1.45] text-body">
          Categories shown here fill the picker on a work and the Inventory filter.
          <strong className="font-medium text-ink"> Hide</strong> takes one out of those
          lists without touching the works that use it;{" "}
          <strong className="font-medium text-ink">Delete</strong> is permanent and asks
          where to move any works first.
        </p>
      </PageHeader>

      <div className="space-y-6">
        <FlashNotice searchParams={sp} />

        <Section title="New category">
          <form action={addCategory} className="flex flex-wrap items-end gap-2">
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-64">
              <label htmlFor="new-category-name" className="label">
                Name
              </label>
              <input id="new-category-name" name="name" required placeholder="Silver" className="field" />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-36">
              <label htmlFor="new-category-code" className="label">
                Code <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input id="new-category-code" name="code" placeholder="auto" className="field tabular" />
            </div>
            <Button type="submit" variant="primary" pendingLabel="Adding…">
              Add category
            </Button>
          </form>
        </Section>

        {hiddenWithWorks.length > 0 ? (
          <Notice tone="warn">
            {hiddenWithWorks.length} hidden categor
            {hiddenWithWorks.length === 1 ? "y is" : "ies are"} still attached to works:{" "}
            {hiddenWithWorks
              .sort((a, b) => b.pieces - a.pieces)
              .map((c) => `${c.name} (${c.pieces})`)
              .join(", ")}
            . Those works keep the category but it can&rsquo;t be filtered for, so they are
            effectively unsorted. Re-categorise them, or Show the category again.
          </Notice>
        ) : null}

        <Section
          title="All categories"
          meta={
            isAdmin
              ? "Works counts both registers. The order here is the order of the picker on a work: drag a grip, or focus it and use the arrow keys."
              : "Works counts both registers."
          }
        >
          {rows.length === 0 ? (
            <EmptyState>No categories yet. Add the first one above.</EmptyState>
          ) : (
            <TableFrame bordered>
              <Table className="min-w-[640px]">
                <thead>
                  <tr>
                    {isAdmin ? (
                      <Th className="relative w-10">
                        <span className="sr-only">Order</span>
                      </Th>
                    ) : null}
                    <Th>Name</Th>
                    <Th>Code</Th>
                    <Th>Status</Th>
                    <Th numeric>Works</Th>
                    <Th className="relative text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <ReorderGrid
                  variant="rows"
                  order={rows.map((c) => c.id)}
                  onReorder={reorder}
                  tiles={Object.fromEntries(
                    rows.map((c) => [
                      c.id,
                      <CategoryTableRow
                        key={c.id}
                        cat={c}
                        reorderable={isAdmin}
                        others={rows
                          .filter((o) => o.id !== c.id)
                          .map((o) => ({ id: o.id, code: o.code, name: o.name }))}
                        updateAction={updateCategory}
                        toggleAction={toggleCategory}
                        deleteAction={deleteCategory}
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
