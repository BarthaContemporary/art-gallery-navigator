import Link from "next/link";
import { createServiceClient } from "@jvb/db/server";
import { CONSENT_TEXTS } from "@/lib/consent-evidence";
import { findPendingConfirmation } from "@/lib/newsletter-optin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter", robots: { index: false } };

/**
 * Second step of the double opt-in: the page the confirmation email links
 * to. Opening it changes nothing; it shows a "Confirm subscription" button,
 * and only that button's POST (newsletter/confirm/route.ts) switches consent
 * on. Mail-security scanners open every link in an incoming email, so a
 * link that confirmed on opening confirmed people who never acted (security
 * review 2026-10, F22). Analytics and marketing tags stay off this page
 * (lib/private-paths.ts): its address is the key to the subscription.
 */
export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const { token } = await params;
  const { retry } = await searchParams;
  let valid = false;
  try {
    valid = Boolean(await findPendingConfirmation(createServiceClient(), token));
  } catch (err) {
    console.error("[newsletter] confirmation lookup failed:", err);
  }

  return (
    <main className="page py-[var(--section)]">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            {valid ? "Confirm your subscription" : "This link has expired"}
          </h1>
          {valid ? (
            <>
              <p className="mt-6 max-w-[var(--measure)] font-serif text-body text-ink-70">
                {CONSENT_TEXTS.newsletter}{" "}
                <Link href="/privacy" className="link-accent">
                  Read the Privacy Notice
                </Link>
                .
              </p>
              <form method="post" action="/newsletter/confirm" className="mt-8">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="btn btn-filled">
                  Confirm subscription
                </button>
              </form>
              {retry ? (
                <p role="alert" className="mt-4 max-w-[var(--measure)] font-sans text-ui text-sumi">
                  We could not confirm your subscription just now. Please try again in a moment.
                </p>
              ) : null}
              <p className="mt-8 max-w-[var(--measure)] font-serif text-ui text-ink-50">
                If you did not ask to subscribe, simply close this page: nothing has been changed.
              </p>
            </>
          ) : (
            <p className="mt-6 max-w-[var(--measure)] font-serif text-body text-ink-70">
              The confirmation link is no longer valid, perhaps because it was already used or is more than 30 days
              old. You can sign up again from the newsletter box at the foot of any page.
            </p>
          )}
          <p className="mt-8">
            <Link href="/" className="link-accent font-sans text-ui">
              Back to the gallery →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
