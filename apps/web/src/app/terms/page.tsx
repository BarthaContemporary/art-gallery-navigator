import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata = {
  title: "Terms & Conditions",
  description: "Terms of use for the Joost van den Bergh website and terms of sale.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms & Conditions" updated="July 2026">
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

      <LegalSection heading="Liability">
        <p>Nothing in these terms excludes liability that cannot be excluded by law. Otherwise, the
        gallery is not liable for indirect or consequential loss arising from use of this website.</p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>These terms are governed by the laws of England and Wales, and the courts of England and
        Wales have exclusive jurisdiction.</p>
      </LegalSection>
    </LegalDoc>
  );
}
