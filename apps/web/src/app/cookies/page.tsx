import { LegalDoc, LegalSection } from "@/components/legal-doc";

export const metadata = {
  title: "Cookie Policy",
  description: "How this website uses cookies and how you can manage them.",
};

export default function CookiesPage() {
  return (
    <LegalDoc title="Cookie Policy" updated="July 2026">
      <p>Cookies are small files stored on your device when you visit a website. This page explains
      how we use them.</p>

      <LegalSection heading="Cookies we use">
        <p><strong>Essential cookies</strong> are needed for the website to function and cannot be
        switched off. <strong>Analytics cookies</strong>, if enabled, help us understand how the
        site is used so we can improve it; these are only set with your consent.</p>
      </LegalSection>

      <LegalSection heading="Managing cookies">
        <p>You can accept or reject non-essential cookies when you first visit the site, and change
        your choice at any time in your browser settings. Blocking some cookies may affect how the
        site works.</p>
      </LegalSection>

      <LegalSection heading="More information">
        <p>For how we handle personal data more generally, see our Privacy Notice.</p>
      </LegalSection>
    </LegalDoc>
  );
}
