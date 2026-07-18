"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

const nullable = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;

export async function addMaker(formData: FormData) {
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

export async function updateMaker(formData: FormData) {
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

export async function deleteMaker(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // pieces.maker_id is ON DELETE SET NULL, so works are unlinked, not removed.
  await supabase.from("makers").delete().eq("id", id);
  revalidatePath("/makers");
  revalidatePath("/inventory");
}
