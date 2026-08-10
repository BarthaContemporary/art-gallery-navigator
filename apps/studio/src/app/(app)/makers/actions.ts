"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

const nullable = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;

/**
 * Send the dealer back to the makers page with something they can act on.
 * These writes used to discard their errors entirely, so a rejected insert
 * looked exactly like a successful one — the form simply cleared and no maker
 * appeared. Mirrors categories/page.tsx and locations/page.tsx.
 */
const fail = (msg: string): never =>
  redirect("/makers?error=" + encodeURIComponent(msg));

function explain(error: { code?: string; message: string }): string {
  if (error.code === "23503")
    return "That maker is still referenced elsewhere and can’t be removed.";
  if (error.code === "42501")
    return "You don’t have permission to change makers. Ask an admin.";
  return error.message;
}

export async function addMaker(formData: FormData) {
  const supabase = await getSupabase();
  const display_name = String(formData.get("display_name") ?? "").trim();
  if (!display_name) fail("A name is required to add a maker.");

  const life_dates = nullable(formData, "life_dates");

  // A second "Kobayashi Shōmin" would quietly split that maker's works in two,
  // so refuse an exact twin — same name and the same (or equally absent) dates.
  // Life dates stay the way to tell two makers of one name apart.
  const twinQuery = supabase
    .from("makers")
    .select("id, display_name")
    .ilike("display_name", display_name);
  const { data: twin } = await (life_dates === null
    ? twinQuery.is("life_dates", null)
    : twinQuery.eq("life_dates", life_dates)
  )
    .limit(1)
    .maybeSingle();
  if (twin)
    fail(
      life_dates === null
        ? `“${twin.display_name}” is already on file. Open it from the list to edit, or add life dates to tell a second maker of that name apart.`
        : `“${twin.display_name}” (${life_dates}) is already on file. Open it from the list to edit.`,
    );

  const { error } = await supabase.from("makers").insert({
    display_name,
    native_name: nullable(formData, "native_name"),
    life_dates,
    region: nullable(formData, "region"),
  });
  if (error) fail(explain(error));
  revalidatePath("/makers");
  // Back to a clean URL: a server action re-renders the page at whatever
  // address it was submitted from, so without this a previous ?error= would
  // keep its banner on screen after a save that actually worked.
  redirect("/makers");
}

export async function deleteMaker(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("That maker could not be identified.");
  // pieces.maker_id is ON DELETE SET NULL, so works are unlinked, not removed.
  // Ask for the deleted row back: a delete the caller isn't allowed to make is
  // filtered out by RLS rather than rejected, so it returns no error and
  // removes nothing. Without this check that reads as a success.
  const { data, error } = await supabase.from("makers").delete().eq("id", id).select("id");
  if (error) fail(explain(error));
  if (!data?.length)
    fail("That maker wasn’t deleted — it may already be gone, or you may not have permission.");
  revalidatePath("/makers");
  revalidatePath("/inventory");
}
