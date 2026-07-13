import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata = {
  title: "Anti-Money-Laundering Notice",
  description: "The gallery's anti-money-laundering and know-your-client obligations.",
};

export default function AmlPage() {
  return (
    <LegalDoc title="Anti-Money-Laundering Notice" updated="July 2026">
      <p>As an art-market participant, the gallery is subject to the Money Laundering, Terrorist
      Financing and Transfer of Funds (Information on the Payer) Regulations 2017 and is registered
      with HM Revenue &amp; Customs for anti-money-laundering supervision.</p>

      <LegalSection heading="Client due diligence">
        <p>Where a transaction, or a series of linked transactions, meets or exceeds the regulatory
        threshold (the equivalent of &euro;10,000), we are required to carry out customer due
        diligence before completing the sale or purchase. This means verifying the identity of the
        client and, where relevant, the beneficial owner, and understanding the source of funds.</p>
      </LegalSection>

      <LegalSection heading="What we may ask for">
        <p>We may ask you to provide identity documents (such as a passport or national identity
        card), proof of address, and information about the source of funds for a purchase. For
        companies, trusts and other entities we may ask for additional ownership information. We use
        secure identity-verification services to help with these checks.</p>
      </LegalSection>

      <LegalSection heading="Records and reporting">
        <p>We keep records of the checks we carry out for five years after the end of the business
        relationship or transaction, as required by law. We are obliged to report knowledge or
        suspicion of money laundering to the authorities and may be unable to tell you if we do so.
        We may decline or delay a transaction where we are unable to complete the required checks.</p>
      </LegalSection>

      <LegalSection heading="Your data">
        <p>Information collected for these checks is handled in accordance with our Privacy Notice
        and is used only for anti-money-laundering and related legal purposes.</p>
      </LegalSection>
    </LegalDoc>
  );
}
