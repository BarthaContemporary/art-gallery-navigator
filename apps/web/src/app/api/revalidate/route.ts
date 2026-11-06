import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { SIGNATURE_HEADER_NAME, isValidSignature } from "@sanity/webhook";
import { safeEqual } from "@/lib/secret";

/**
 * Sanity webhook → tag revalidation.
 * Configure the webhook (create/update/delete, all types) with the shared
 * secret SANITY_REVALIDATE_SECRET; @sanity/webhook verifies the signature.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SANITY_REVALIDATE_SECRET;

    // Legacy Sanity webhooks (and manual triggers) can't sign the payload, so
    // also accept the secret via ?secret= or an x-revalidate-secret header.
    const querySecret =
      req.nextUrl.searchParams.get("secret") || req.headers.get("x-revalidate-secret");
    if (secret && safeEqual(querySecret, secret)) {
      let type: string | undefined;
      try {
        const json = (await req.json()) as { _type?: string };
        type = json?._type;
      } catch {
        // no/invalid body — revalidate everything
      }
      if (type) for (const t of tagsFor(type)) revalidateTag(t);
      else {
        for (const t of ["work", "artist", "exhibition", "publication", "collection", "page", "siteSettings", "journalPost"]) {
          revalidateTag(t);
        }
      }
      return NextResponse.json({ revalidated: true, tag: type ?? "all", now: Date.now() });
    }

    const { isValidSignature, body } = await parseBody<{
      _type?: string;
      slug?: { current?: string };
    }>(req, secret);

    if (!isValidSignature) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
    if (!body?._type) {
      return NextResponse.json({ message: "Missing _type" }, { status: 400 });
    }

    // Every sanityFetch is tagged with its document type (and "sanity").
    for (const t of tagsFor(body._type)) revalidateTag(t);
    // siteSettings/work references surface on most pages; nothing else needed —
    // per-type tags cover list + detail routes alike.

    return NextResponse.json({
      revalidated: true,
      tag: body._type,
      now: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * A signed webhook's body and whether its signature matches `secret`: null
 * when the request has no signature header or no secret is set. Unless the
 * signature is wrong it first waits 3 s, so the change has reached the
 * Content Lake's read side before the pages refetch. The same steps as
 * next-sanity's `parseBody`, which this replaces.
 */
async function parseBody<T>(
  req: NextRequest,
  secret: string | undefined,
): Promise<{ body: T | null; isValidSignature: boolean | null }> {
  const signature = req.headers.get(SIGNATURE_HEADER_NAME);
  if (!signature) {
    console.error("Missing signature header");
    return { body: null, isValidSignature: null };
  }
  const body = await req.text();
  const valid = secret ? await isValidSignature(body, signature, secret.trim()) : null;
  if (valid !== false) await new Promise((resolve) => setTimeout(resolve, 3000));
  return { body: body.trim() ? (JSON.parse(body) as T) : null, isValidSignature: valid };
}

/**
 * A document type and the tags its change must refresh. A synced inventory
 * list only matters through the events that reference it, which are cached
 * under "exhibition".
 */
function tagsFor(type: string): string[] {
  return type === "workList" ? ["workList", "exhibition"] : [type];
}
