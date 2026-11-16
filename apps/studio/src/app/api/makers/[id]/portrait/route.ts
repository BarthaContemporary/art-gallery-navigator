import { NextResponse } from "next/server";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { makerPortraitPath } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portrait removal. Uploading happens in two legs — ./upload-url (signed
 * direct-to-storage upload; Vercel routes cap bodies at 4.5MB so originals
 * never travel through a function) and ./process (display-master
 * generation) — see those routes.
 *
 * All three run with the service role, which RLS does not limit, so each
 * checks the role itself first: changing a maker is for admin and staff,
 * the accountant only reads (security review 2026-10, F8).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Your role cannot change makers" }, { status: 403 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("id, portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only this maker's own portrait files: a path that points anywhere else
  // is left alone rather than removed with the service role.
  const paths = [maker.portrait_path, maker.portrait_original_path]
    .map((p) => makerPortraitPath(p, maker.id))
    .filter((p): p is string => !!p);
  // The row first, checked: the files go only once nothing names them. The
  // other way round, a failed update left the row naming two deleted files
  // (no portrait in the studio, nothing for the website sync). The update
  // also raises the maker's website sync, which needs only the row.
  const { data: updated, error: updErr } = await svc
    .from("makers")
    .update({ portrait_path: null, portrait_original_path: null, portrait_focus: null })
    .eq("id", id)
    .select("id");
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (paths.length) await svc.storage.from("maker-portraits").remove(paths);
  return NextResponse.json({ ok: true });
}
