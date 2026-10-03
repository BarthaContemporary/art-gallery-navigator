import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata = {
  title: "Terms & Conditions",
  description: "Terms of use for the Joost van den Bergh website and terms of sale.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms & Conditions" updated="October 2026">
      <p>These terms govern your use of this website and, together with any invoice or written
      agreement, our sale of works of art. By using this website you accept these terms.</p>

      <LegalSection heading="The website">
        <p>The content of this website is for general information about the gallery and its
        exhibitions and is subject to change without notice. All images, text and other material are
        owned by or licensed to the gallery and may not be reproduced without permission.</p>
      </LegalSection>

      <LegalSection heading="Works and availability">
        <p>All works are offered subject to availability and prior sale. Prices are available on
        request unless stated. Descriptions, dimensions and attributions are given in good faith;
        any specific condition or provenance information forms part of the individual sale terms for
        a work.</p>
      </LegalSection>

      <LegalSection heading="Sales">
        <p>A sale is concluded only when confirmed by the gallery in writing and payment has been
        received in cleared funds. Title passes on full payment. Sales may be subject to
        anti-money-laundering checks (see our AML notice) and to export or cultural-property
        requirements where applicable.</p>
      </LegalSection>

      <LegalSection heading="Prices and payment">
        <p>Prices quoted to consumers include VAT where it applies; works sold under the VAT margin
        scheme are so described on the invoice. Prices in other currencies are indicative and the
        pounds sterling price on the invoice prevails. Payment is by bank transfer unless agreed
        otherwise; we do not accept cash above the limit set by the Money Laundering Regulations.</p>
      </LegalSection>
      <LegalSection heading="Consumer rights">
        <p>If you buy as a consumer by email, telephone or online rather than at the gallery or a fair,
        the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 give
        you fourteen days from delivery to cancel without giving a reason, except for works made or
        altered to your specification. To cancel, tell us in writing within that period and return the
        work undamaged in its original packing within fourteen days; we refund within fourteen days of
        receiving it, less any loss in value caused by handling beyond what is needed to inspect it. You
        bear the cost of return unless we agree otherwise. Under the Consumer Rights Act 2015 works
        must match their description; nothing in these terms limits those rights.</p>
      </LegalSection>
      <LegalSection heading="Export, cultural property and protected materials">
        <p>Works above the relevant value thresholds may need an export licence from Arts Council
        England before leaving the United Kingdom; we will tell you where this applies and can apply on
        your behalf. Works containing ivory, tortoiseshell, coral, certain woods or other protected
        species are sold only where the Ivory Act 2018 and CITES allow, with the necessary exemption
        certificates or permits, and buyers are responsible for import rules in their own country.</p>
      </LegalSection>
      <LegalSection heading="Liability">
        <p>Nothing in these terms excludes liability that cannot be excluded by law. Otherwise, the
        gallery is not liable for indirect or consequential loss arising from use of this website.</p>
      </LegalSection>

      <LegalSection heading="Complaints">
        <p>If something has gone wrong, write to us and we will reply within fourteen days. Consumers
        may also use the UK\u2019s alternative dispute resolution bodies; we will tell you which one we
        would use if we cannot resolve a complaint directly.</p>
      </LegalSection>
      <LegalSection heading="Governing law">
        <p>These terms are governed by the laws of England and Wales, and the courts of England and
        Wales have exclusive jurisdiction.</p>
      </LegalSection>
    </LegalDoc>
  );
}
