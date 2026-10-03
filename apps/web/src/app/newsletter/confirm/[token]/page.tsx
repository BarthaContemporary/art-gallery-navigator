import Link from "next/link";
import { createServiceClient } from "@jvb/db/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter", robots: { index: false } };

/**
 * Second step of the double opt-in: the link from the confirmation email.
 * Switches marketing consent on, stamps the confirmation into the consent
 * evidence and retires the token.
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let state: "confirmed" | "invalid" = "invalid";

  if (/^[a-f0-9]{48}$/.test(token)) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, consent_evidence")
      .eq("consent_confirm_token", token)
      .maybeSingle();
    const row = data as { id: string; consent_evidence: Record<string, unknown> | null } | null;
    if (row) {
      const now = new Date().toISOString();
      const marketing = (row.consent_evidence?.marketing ?? {}) as Record<string, unknown>;
      const { error } = await supabase
        .from("crm_contacts")
        .update({
          marketing_consent: true,
          consent_date: now,
          consent_source: "website_newsletter",
          unsubscribed_at: null,
          do_not_mail: false,
          consent_confirm_token: null,
          consent_evidence: { ...(row.consent_evidence ?? {}), marketing: { ...marketing, confirmed_at: now } },
        })
        .eq("id", row.id);
      if (!error) state = "confirmed";
    }
  }

  return (
    <main className="page py-[var(--section)]">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            {state === "confirmed" ? "You’re subscribed" : "This link has expired"}
          </h1>
          <p className="mt-6 max-w-[var(--measure)] font-serif text-body text-ink-70">
            {state === "confirmed"
              ? "Thank you — we’ll send you news of exhibitions, fairs and new works. Every email carries an unsubscribe link, and you can withdraw consent at any time."
              : "The confirmation link is no longer valid, perhaps because it was already used. You can sign up again from the newsletter box at the foot of any page."}
          </p>
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
