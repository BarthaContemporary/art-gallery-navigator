import { NextResponse } from "next/server";
import { safeStoragePath, UUID_PATTERN } from "@jvb/db/storage-path";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = new RegExp(`^${UUID_PATTERN}$`);

/**
 * The stored path, unless it could climb out of its folder. The strict
 * safeStoragePath shape when it fits; otherwise (an imported file name with
 * a space, say) any relative key without "." / ".." or empty segments. The
 * signing client is the user's own, so storage policies decide the rest.
 */
function documentPath(path: unknown): string | null {
  const strict = safeStoragePath(path);
  if (strict) return strict;
  if (typeof path !== "string" || !path || path.length > 1024 || path.startsWith("/") || path.includes("\\")) {
    return null;
  }
  if (/%2e|%2f|%5c/i.test(path)) return null;
  return path.split("/").every((s) => s !== "" && s !== "." && s !== "..") ? path : null;
}

function plain(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

/**
 * The document page's "Download file": signs the file when it is clicked and
 * redirects to it. The page used to sign a five-minute URL while rendering,
 * so the link stopped working once the tab had been open for a while. This
 * link never expires, and opens in a new tab or a middle click as before.
 *
 * The row is read through the signed-in user's own client, so the document
 * policies still decide: staff never reach an invoice, the accountant only
 * invoices. The file is signed with that same client (storage policies
 * apply), for a minute, which the redirect uses at once.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return plain("Sign in to download this file.", 401);
  if (!hasRole(session.roles, "admin", "staff", "accountant")) return plain("Your role cannot open documents.", 403);

  const { id } = await params;
  if (!ID.test(id)) return plain("Document not found.", 404);

  const supabase = await getSupabase();
  const { data: doc, error } = await supabase
    .from("piece_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return plain(`Could not read the document: ${error.message}`, 500);
  const path = documentPath(doc?.storage_path);
  if (!doc || !path) return plain("This document has no file.", 404);

  const { data: signed, error: signError } = await supabase.storage
    .from("piece-documents")
    .createSignedUrl(path, 60);
  if (signError || !signed?.signedUrl) {
    return plain(`Could not open the file: ${signError?.message ?? "no link was issued"}`, 502);
  }
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
