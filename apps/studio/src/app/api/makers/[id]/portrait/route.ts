import { NextResponse } from "next/server";
import { getSession, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portrait removal. Uploading happens in two legs — ./upload-url (signed
 * direct-to-storage upload; Vercel routes cap bodies at 4.5MB so originals
 * never travel through a function) and ./process (display-master
 * generation) — see those routes.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const paths = [maker.portrait_path, maker.portrait_original_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length) await svc.storage.from("maker-portraits").remove(paths);
  await svc
    .from("makers")
    .update({ portrait_path: null, portrait_original_path: null })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
