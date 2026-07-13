import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata = {
  title: "Privacy Notice",
  description: "How Joost van den Bergh collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Notice" updated="July 2026">
      <p>
        This notice explains how Joost van den Bergh (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the
        &ldquo;gallery&rdquo;) collects and uses your personal data, and your rights under the UK
        General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. The gallery is
        the data controller. For any data-protection query, contact us using the details at the end
        of this notice.
      </p>

      <LegalSection heading="Information we collect">
        <p>We may collect: your name and contact details; your collecting and enquiry history;
        correspondence with us; purchase, sale and shipping information; identity and source-of-funds
        information where required for anti-money-laundering checks; and information about your use of
        this website (see our Cookie Policy).</p>
      </LegalSection>

      <LegalSection heading="How we use it, and our legal basis">
        <p>We use your data to respond to enquiries and provide our services (performance of a
        contract or steps prior to a contract); to manage our relationship with collectors and, where
        you have agreed, to send you catalogues, offers and art-fair previews (consent, and our
        legitimate interest in promoting the gallery); to meet legal obligations including
        anti-money-laundering, tax and record-keeping duties (legal obligation); and to operate and
        secure this website (legitimate interest).</p>
      </LegalSection>

      <LegalSection heading="Marketing">
        <p>We only send marketing where you have consented or where we are otherwise permitted to do
        so. You can withdraw consent at any time using the unsubscribe link in our emails or by
        contacting us.</p>
      </LegalSection>

      <LegalSection heading="Sharing your data">
        <p>We share data with service providers who act on our instructions — for example website
        hosting, email delivery, payment processing and identity-verification providers — and with
        HMRC, law-enforcement or other authorities where we are legally required to do so, including
        in connection with anti-money-laundering obligations. We do not sell your data.</p>
      </LegalSection>

      <LegalSection heading="International transfers">
        <p>Some of our providers process data outside the United Kingdom. Where they do, we rely on
        appropriate safeguards such as adequacy regulations or standard contractual clauses.</p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>We keep personal data only as long as necessary for the purposes above. Records required
        for anti-money-laundering purposes are retained for five years after the end of our business
        relationship or a transaction, as required by law. Accounting records are kept for the period
        required by tax law.</p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>You have the right to access your data; to have it corrected or erased; to restrict or
        object to its processing; to data portability; and to withdraw consent. These rights may be
        limited where we must retain data to meet a legal obligation. You may also complain to the
        Information Commissioner&rsquo;s Office (ico.org.uk).</p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>For any privacy matter, or to exercise your rights, please contact the gallery. We will
        respond within the time limits set by law.</p>
      </LegalSection>

      <p className="text-[13px] text-ink-soft">
        This notice is provided for information and is kept under review.
      </p>
    </LegalDoc>
  );
}
