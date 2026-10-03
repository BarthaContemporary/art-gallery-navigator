import { LegalDoc, LegalSection } from "@/components/legal-doc";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";

export const metadata = {
  title: "Accessibility",
  description: "Our commitment to an accessible website, and how to tell us if something is not working for you.",
};

/** Equality Act 2010 s.29 (reasonable adjustments) — a statement is good
 *  practice for a private business; the commitments below are what the site
 *  is built to. */
export default async function AccessibilityPage() {
  const s = await getSiteSettings();
  const galleryName = s?.galleryName ?? fallbackGalleryName;
  const email = s?.email ?? null;
  return (
    <LegalDoc title="Accessibility" updated="October 2026">
      <p>
        {galleryName} wants everyone to be able to use this website. It is built to meet the Web
        Content Accessibility Guidelines (WCAG) 2.2 at level AA, and we test it with a keyboard, with
        screen readers and at high zoom.
      </p>
      <LegalSection heading="What we do">
        <p>
          Every page works with a keyboard alone; images of works carry descriptions; headings and
          landmarks are consistent; text can be resized to 200% without loss; colour contrast meets
          the AA ratio; animation respects your system\u2019s reduced-motion setting; and forms explain
          any error in words.
        </p>
      </LegalSection>
      <LegalSection heading="Known limitations">
        <p>
          Publication readers are page images, so their text is not machine-readable; ask us and we
          will send a text or large-print version. Some historic exhibition images lack detailed
          descriptions; we add them as we catalogue.
        </p>
      </LegalSection>
      <LegalSection heading="Tell us">
        <p>
          If any part of this site is hard to use, or you would like information in another format,
          {email ? (
            <>
              {" "}email{" "}
              <a href={`mailto:${email}`} className="underline">
                {email}
              </a>
            </>
          ) : (
            <> contact the gallery</>
          )}{" "}
          and we will respond within five working days. We are happy to arrange a private viewing or
          describe any work by telephone.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
