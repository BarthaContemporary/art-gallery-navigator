import type { NextRequest } from "next/server";
import { createServiceClient } from "@jvb/db/server";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe target used in newsletter footers
 * (and as the List-Unsubscribe URL). Expects a per-contact token stored
 * in crm_contacts.unsubscribe_token; sets unsubscribed_at.
 * GET so it works from any mail client link.
 */

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { font-family: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
         background: oklch(0.985 0 0); color: oklch(0.31 0 0);
         display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
  main { max-width: 26rem; }
  h1 { font-size: 1.25rem; color: oklch(0.19 0 0); letter-spacing: -0.01em; }
  p { line-height: 1.6; font-size: 0.9375rem; color: oklch(0.5 0 0); }
</style>
</head>
<body><main><h1>${title}</h1><p>${body}</p></main></body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 8) {
    return htmlPage(
      "Link not recognised",
      "This unsubscribe link is not valid. You can also unsubscribe by replying to any of our emails.",
    );
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("crm_contacts")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("id");

    if (error) throw error;

    if (!data || (data as unknown[]).length === 0) {
      return htmlPage(
        "Link not recognised",
        "This unsubscribe link is not valid or has already been used. You can also unsubscribe by replying to any of our emails.",
      );
    }

    return htmlPage(
      "You have been unsubscribed",
      "You will no longer receive mailings from us. If this was a mistake, just reply to any previous email and we will restore your subscription.",
    );
  } catch (error) {
    console.error("[unsubscribe] failed:", error);
    return htmlPage(
      "Something went wrong",
      "We could not process the unsubscribe automatically. Please reply to any of our emails and we will remove you by hand.",
    );
  }
}
