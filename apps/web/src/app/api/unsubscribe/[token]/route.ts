import type { NextRequest } from "next/server";
import { createServiceClient } from "@jvb/db/server";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe target used in newsletter and offer footers and as the
 * List-Unsubscribe URL. The token lives in unsubscribe_tokens; acting on it
 * sets crm_contacts.unsubscribed_at and withdraws marketing consent.
 *
 * GET only shows a confirmation page with an Unsubscribe button: mail
 * security gateways (Safe Links, Proofpoint, Mimecast…) open every link in
 * an incoming email, so a GET that acted would unsubscribe readers who never
 * clicked (the same reason the newsletter confirmation is a POST button).
 * The change itself happens on POST, from that button or from a mailbox
 * provider's own one-click Unsubscribe (RFC 8058, List-Unsubscribe-Post).
 */

function htmlPage(title: string, body: string, extra = ""): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>
  body { font-family: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
         background: oklch(0.985 0 0); color: oklch(0.31 0 0);
         display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
  main { max-width: 26rem; }
  h1 { font-size: 1.25rem; color: oklch(0.19 0 0); letter-spacing: -0.01em; }
  p { line-height: 1.6; font-size: 0.9375rem; color: oklch(0.5 0 0); }
  button { font: inherit; font-size: 0.9375rem; margin-top: 0.5rem; padding: 0.75rem 1.5rem; min-height: 44px;
           background: oklch(0.19 0 0); color: oklch(0.985 0 0); border: 0; cursor: pointer; }
  button:hover, button:focus-visible { background: oklch(0.31 0 0); }
</style>
</head>
<body><main><h1>${title}</h1><p>${body}</p>${extra}</main></body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

const notRecognised = () =>
  htmlPage(
    "Link not recognised",
    "This unsubscribe link is not valid or has already been used. You can also unsubscribe by replying to any of our emails.",
  );

const failed = () =>
  htmlPage(
    "Something went wrong",
    "We could not process the unsubscribe automatically. Please reply to any of our emails and we will remove you by hand.",
  );

/** The contact a token belongs to, or null for an unknown token. Throws on a failed lookup. */
async function contactForToken(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
): Promise<string | null> {
  // Tokens live in their own table so a leaked token never exposes contact data.
  const { data, error } = await supabase
    .from("unsubscribe_tokens")
    .select("contact_id")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as { contact_id: string } | null)?.contact_id ?? null;
}

/** Too short to be a real token (the studio's preview link uses "preview"). */
const malformed = (token: string | undefined): boolean => !token || token.length < 8;

/** Shows the confirmation; never writes. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (malformed(token)) return notRecognised();

  try {
    const contactId = await contactForToken(createServiceClient(), token);
    if (!contactId) return notRecognised();
    // No action attribute: the form posts back to this same address, which
    // the site's CSP (form-action 'self') allows on every host it is served on.
    return htmlPage(
      "Unsubscribe from our mailings",
      "Press the button below and we will stop sending you newsletters and other mailings.",
      `<form method="post"><button type="submit">Unsubscribe</button></form>`,
    );
  } catch (error) {
    console.error("[unsubscribe] lookup failed:", error instanceof Error ? error.message : error);
    return failed();
  }
}

/**
 * Does the unsubscribe: the confirmation page's button, and one-click
 * unsubscribe (RFC 8058), where mail providers POST
 * "List-Unsubscribe=One-Click" to the List-Unsubscribe address when the
 * reader presses their own Unsubscribe button. Reads nothing from the body,
 * so both work in one step.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (malformed(token)) return notRecognised();

  try {
    const supabase = createServiceClient();
    const contactId = await contactForToken(supabase, token);
    if (!contactId) return notRecognised();

    const { data, error } = await supabase
      .from("crm_contacts")
      .update({ unsubscribed_at: new Date().toISOString(), marketing_consent: false })
      .eq("id", contactId)
      .select("id");
    if (error) throw error;
    if (!data || (data as unknown[]).length === 0) return notRecognised();

    return htmlPage(
      "You have been unsubscribed",
      "You will no longer receive mailings from us. If this was a mistake, just reply to any previous email and we will restore your subscription.",
    );
  } catch (error) {
    console.error("[unsubscribe] failed:", error instanceof Error ? error.message : error);
    return failed();
  }
}
