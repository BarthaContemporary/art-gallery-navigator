import Link from "next/link";
import { LegalDoc, LegalSection } from "@/components/legal-doc";
import { ConsentReopenLink } from "@/components/consent-reopen-link";

export const metadata = {
  title: "Cookie Policy",
  description:
    "Exactly which cookies and similar technologies this website uses, what each one does, how long it lasts, and how to change your choice.",
};

export default function CookiesPage() {
  return (
    <LegalDoc title="Cookie Policy" updated="July 2026">
      <p>
        This page lists every cookie and similar technology this website uses — what each
        one does, how long it lasts, and who receives the data. &ldquo;Cookies&rdquo; here
        also covers comparable ways of storing data on your device, such as your
        browser&rsquo;s local storage.
      </p>

      <p>
        The approach is a standard one, used by most professional websites: a small number
        of strictly necessary items that keep the site working, plus optional analytics and
        marketing tools that run only if you agree to them. The optional ones genuinely help
        — they tell us which works people want to see, so we can show more of them. They are
        exactly that, though: optional. The site is fully functional whether you accept or
        decline.
      </p>

      <LegalSection heading="1 · Strictly necessary">
        <p>
          These keep the site working and are used under our legitimate interest in
          operating it securely. They are not used for advertising or for tracking you
          between websites, and they are not covered by the consent notice because the site
          cannot work without them.
        </p>
        <p>
          <strong>Your cookie choice</strong> — kept in your browser&rsquo;s local storage
          as <code>jvb.consent.v1</code>. It records which categories you accepted or
          declined and when. Without it we would have to ask you again on every page. It
          stays until you change your choice or clear it, and never leaves your device.
        </p>
        <p>
          <strong>Private viewing-room access</strong> — a cookie named <code>oa_…</code> is
          set only if you unlock a private offer page we have sent you, using its password
          or a sign-in link. It confirms you are entitled to see that page. It expires after
          12 hours, is restricted to that one page, and is marked HttpOnly, Secure and
          SameSite=Lax, so scripts cannot read it and it is not sent to other sites. If you
          have not been sent an offer, you will never receive it.
        </p>
        <p>
          <strong>Spam protection</strong> — our booking and enquiry forms use Cloudflare
          Turnstile to distinguish people from bots. It runs only on pages carrying a form
          and may store a short-lived token on your device while it makes that check. It is
          a privacy-preserving alternative to reCAPTCHA: it does not profile you or follow
          you across sites. Cloudflare acts as our processor — see{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Cloudflare&rsquo;s privacy policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="2 · Analytics — optional, off until you accept">
        <p>
          <strong>Plausible Analytics</strong>, which we host ourselves at
          analytics.joostvandenbergh.com. It counts page views and shows us which works and
          exhibitions draw interest, so we can put more of that on the site.
        </p>
        <p>
          Plausible is deliberately the least invasive option we could find: it sets no
          cookies, stores nothing on your device, does not follow you between websites, and
          does not build a profile of you. Because we run it on our own server, the data
          stays with us — it is not sold, shared, or passed to any advertising network. It
          stays switched off entirely until you accept analytics.
        </p>
      </LegalSection>

      <LegalSection heading="3 · Marketing — optional, off until you accept">
        <p>
          <strong>The Meta pixel</strong> (Facebook and Instagram). If you accept marketing,
          a script from <code>connect.facebook.net</code> loads and records that you visited
          this site and which pages you viewed. It lets us show our exhibitions to people on
          Facebook and Instagram, and to reach audiences with similar interests.
        </p>
        <p>
          It sets cookies including <code>_fbp</code>, typically lasting around three
          months. If you are signed in to Facebook or Instagram, Meta can connect that visit
          to your account. The data goes to Meta Platforms Ireland Limited, which acts as a
          joint controller with us for this collection, and may be transferred outside the
          UK and EEA under the safeguards Meta operates. This is the only item on this page
          that sends information about you to a third party, which is why it sits behind its
          own separate toggle rather than being bundled with analytics.
        </p>
        <p>
          Meta explains its use of this data in its{" "}
          <a
            href="https://www.facebook.com/privacy/policy/"
            target="_blank"
            rel="noreferrer noopener"
          >
            privacy policy
          </a>
          , and you can change what it shows you in your{" "}
          <a
            href="https://accountscenter.facebook.com/ad_preferences"
            target="_blank"
            rel="noreferrer noopener"
          >
            Meta ad preferences
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="4 · Your choice, and changing it">
        <p>
          On your first visit a notice appears at the foot of the page. Nothing optional
          runs before you answer it — no analytics, no pixel, and nothing stored beyond what
          is needed to remember your answer. Declining takes one click, exactly as accepting
          does; the notice never blocks the page and does not return to nag you. Under
          &ldquo;Choose&rdquo; you can accept one category and refuse the other.
        </p>
        <p>
          To change or withdraw your choice at any time, use <ConsentReopenLink /> — here,
          or in the footer of every page. Withdrawal takes effect immediately and stops any
          further collection.
        </p>
        <p>
          One limitation, stated plainly: withdrawing consent stops the pixel from loading
          again, but it cannot delete cookies Meta has already placed on your device. To
          remove those, clear cookies in your browser settings or use the Meta links above.
          You can also block or delete cookies for this or any site directly in your
          browser.
        </p>
      </LegalSection>

      <LegalSection heading="5 · Legal basis and retention">
        <p>
          Strictly necessary items are used under legitimate interest. Analytics and
          marketing are used only with your consent, as required by the Privacy and
          Electronic Communications Regulations (PECR) and the UK GDPR — which is why they
          are off by default, and why refusing is as easy as agreeing. Individual lifetimes
          are given against each item above.
        </p>
      </LegalSection>

      <LegalSection heading="6 · Questions">
        <p>
          For how we handle personal data more broadly, including your rights of access and
          erasure, see our <Link href="/privacy">Privacy Notice</Link>. If anything here is
          unclear, or you would like to know what we hold about you, please{" "}
          <Link href="/contact">get in touch</Link> — we will respond within 30 days.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
