import { LegalDoc, LegalSection } from "@/components/legal-doc";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";

export const metadata = {
  title: "Privacy Notice",
  description: "How Joost van den Bergh collects, uses, shares and protects your personal data, and your rights.",
};

/**
 * UK GDPR Arts. 13/14 notice. Processor names, retention periods and the
 * lawful bases here mirror the system as built (see docs/compliance): change
 * one and change the other. Controller details come from site settings.
 */
export default async function PrivacyPage() {
  const s = await getSiteSettings();
  const galleryName = s?.galleryName ?? fallbackGalleryName;
  const legalName = s?.legalName ?? galleryName;
  const address = (s?.registeredOffice ?? s?.address ?? "St James\u2019s, London").replace(/\r?\n/g, ", ");
  const email = s?.dpContactEmail ?? s?.email ?? null;

  return (
    <LegalDoc title="Privacy Notice" updated="October 2026">
      <p>
        This notice explains how {galleryName} collects and uses personal data, who we share it with,
        how long we keep it, and your rights under the UK General Data Protection Regulation (UK GDPR)
        and the Data Protection Act 2018.
      </p>

      <LegalSection heading="Who we are">
        <p>
          The data controller is {legalName}
          {s?.companyNumber ? `, a company registered in England and Wales (no. ${s.companyNumber})` : ""}
          , of {address}.{" "}
          {email ? (
            <>
              For any privacy matter, or to exercise your rights, write to{" "}
              <a href={`mailto:${email}`} className="underline">
                {email}
              </a>
              .
            </>
          ) : (
            <>For any privacy matter, or to exercise your rights, write to the gallery at the address above.</>
          )}{" "}
          We have not appointed a statutory Data Protection Officer; the gallery\u2019s principal is
          responsible for data protection.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect and where it comes from">
        <p>
          <strong>From you:</strong> your name and contact details, correspondence, enquiries and
          appointment requests, your collecting interests, and purchase, sale, consignment and shipping
          details. Where the law requires it, identity documents, proof of address and information about
          the source of funds.
        </p>
        <p>
          <strong>From other sources:</strong> the UK Sanctions List published by the Foreign,
          Commonwealth &amp; Development Office, and public records used for anti-money-laundering
          checks; shippers and insurers in connection with a delivery.
        </p>
        <p>
          <strong>From your use of this website:</strong> only what you consent to in the cookie
          choice (see our Cookie Policy), plus the technical data needed to keep the site secure.
        </p>
      </LegalSection>

      <LegalSection heading="Why we use it and our lawful basis">
        <p><strong>Answering enquiries and arranging appointments</strong> \u2014 steps you ask us to take before a contract, and our legitimate interest in running the gallery.</p>
        <p><strong>Selling, buying and consigning works, invoicing, shipping and insurance</strong> \u2014 performance of a contract, and our legal obligations to keep tax and accounting records.</p>
        <p><strong>Our newsletter</strong> \u2014 your consent, given by double opt-in and withdrawable at any time with the link in every email. For existing clients we may rely on the \u201csoft opt-in\u201d in the Privacy and Electronic Communications Regulations, with the same right to opt out.</p>
        <p><strong>Private offers and previews sent to you personally</strong> \u2014 our legitimate interest in offering works to collectors we know; you can ask us to stop at any time.</p>
        <p><strong>Anti-money-laundering due diligence and sanctions screening</strong> \u2014 our legal obligations as an HMRC-supervised art market participant under the Money Laundering Regulations 2017 and the Sanctions and Anti-Money Laundering Act 2018.</p>
        <p><strong>Keeping the website and our systems secure</strong> \u2014 our legitimate interest in preventing abuse and fraud.</p>
        <p><strong>Website statistics and advertising measurement</strong> \u2014 your consent, as set in the cookie choice.</p>
        <p>We do not make decisions about you by automated means. Sanctions screening produces possible name matches that are always reviewed by a person.</p>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <p>
          Service providers who process data on our instructions under written contracts: Vercel
          (hosting of this website and our internal system, USA); Vultr (our database and image storage,
          London, UK); Resend (email delivery, USA); Sanity (website content, EU and USA); Cloudflare
          (protection of our forms against automated abuse, global); and Meta, only if you accept
          marketing cookies. Our accountants, solicitors and insurers where needed. Shippers and
          insurers when a work is delivered to you. Identity-verification providers where we use one
          for anti-money-laundering checks.
        </p>
        <p>
          Public authorities where the law requires it, including HM Revenue &amp; Customs, the
          National Crime Agency and the Office of Financial Sanctions Implementation. We do not sell
          personal data.
        </p>
      </LegalSection>

      <LegalSection heading="International transfers">
        <p>
          Our data is stored in the United Kingdom. Some providers process data in the United States or
          the European Economic Area. Transfers to the EEA are covered by the UK\u2019s adequacy
          regulations. Transfers to the United States rely on the UK Extension to the EU\u2013US Data
          Privacy Framework where the provider is certified, and otherwise on the International Data
          Transfer Agreement or the UK Addendum to the EU standard contractual clauses.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p><strong>Enquiries:</strong> three years. <strong>Appointment bookings:</strong> two years.</p>
        <p><strong>Newsletter subscription:</strong> until you unsubscribe; we then keep a record that you opted out so that we do not email you again. A sign-up that is never confirmed is deleted after 30 days.</p>
        <p><strong>Email delivery records and private-offer page views:</strong> two years.</p>
        <p><strong>Purchase, sale and consignment records:</strong> six years after the end of the tax year, as tax law requires.</p>
        <p><strong>Anti-money-laundering records:</strong> five years after the end of our business relationship or the transaction, as the Money Laundering Regulations require.</p>
        <p><strong>Contact records with no activity</strong> are reviewed for deletion after five years.</p>
        <p>When you ask us to erase your data we delete everything we are not legally required to keep, and remove your identity from anything we must retain.</p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can ask for a copy of your data; have it corrected or erased; restrict or object to how we
          use it; receive the data you gave us in a portable form; and withdraw consent at any time. We
          respond within one month, free of charge, and may ask you to confirm your identity. Some rights
          are limited where we must keep data to meet a legal obligation, and we will tell you if that
          applies.
        </p>
        <p>
          If you are unhappy with how we handle your data you can complain to the Information
          Commissioner\u2019s Office: ico.org.uk, 0303 123 1113, Wycliffe House, Water Lane, Wilmslow,
          Cheshire SK9 5AF. We would welcome the chance to resolve any concern first.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Data is held in encrypted, access-controlled systems in the UK; access is limited to gallery
          staff who need it, protected by strong authentication; backups are encrypted; and every
          change is logged. This website and our systems are served only over HTTPS.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>Our services and this website are intended for adults. We do not knowingly collect data about anyone under 18.</p>
      </LegalSection>

      <LegalSection heading="Changes to this notice">
        <p>We review this notice at least annually and whenever our processing changes. The date at the top shows the current version.</p>
      </LegalSection>
    </LegalDoc>
  );
}
