import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "A short glossary of terms used in cataloguing Japanese and Indian works of art — okimono, tomobako, shibuichi, shakudo, patina and more.",
};

const terms: { term: string; definition: string }[] = [
  {
    term: "Okimono",
    definition:
      "A Japanese decorative sculpture, literally a 'placed thing' — an ornament for display in an alcove or on a cabinet, most often in bronze, ivory or wood, and a specialty of the Meiji era.",
  },
  {
    term: "Tomobako",
    definition:
      "The original fitted wooden box made for a Japanese work of art, frequently inscribed with the title of the piece and signed or sealed by the artist. An important part of a work's documentation.",
  },
  {
    term: "Meiji era",
    definition:
      "The reign of Emperor Meiji, 1868–1912 — a period of extraordinary technical brilliance in the Japanese decorative arts, when leading workshops produced metalwork and cloisonné of unmatched refinement for international exhibitions.",
  },
  {
    term: "Shibuichi",
    definition:
      "A Japanese alloy of copper and silver, patinating to subtle grey-brown tones. Prized for sword fittings and later for the inlaid surfaces of Meiji metalwork.",
  },
  {
    term: "Shakudō",
    definition:
      "An alloy of copper with a small proportion of gold, patinated to a lustrous blue-black. Used with gold and silver inlay to painterly effect in fine Japanese metalwork.",
  },
  {
    term: "Patina",
    definition:
      "The surface colour and texture a metal object acquires through deliberate chemical treatment and age. Original patina is fragile and precious — it should never be polished away.",
  },
  {
    term: "Signature / seal",
    definition:
      "Japanese works are commonly signed with chiselled characters or inlaid seals, often naming the artist and studio. Signatures are compared against recorded examples as part of cataloguing.",
  },
  {
    term: "Provenance",
    definition:
      "The recorded history of a work's ownership — earlier collections, auctions, exhibitions and publications. Documented provenance supports authenticity.",
  },
  {
    term: "Attribution",
    definition:
      "Qualified language for authorship: 'signed' means the work bears the artist's signature; 'attributed to' expresses a considered but not certain opinion; 'school of' or 'workshop of' indicates production in the artist's circle.",
  },
  {
    term: "Bidri ware",
    definition:
      "Indian metalwork from Bidar in the Deccan: a blackened zinc alloy inlaid with silver or brass in floral and geometric designs, at its finest in the 17th and 18th centuries.",
  },
  {
    term: "Company School",
    definition:
      "Indian paintings made for British patrons during the East India Company period, typically watercolours of natural history, trades and topography, blending Indian technique with European taste.",
  },
  {
    term: "POA",
    definition:
      "'Price on application' — the price is available on request rather than published. Simply quote the work's stock number when enquiring.",
  },
  {
    term: "Condition report",
    definition:
      "A written account of a work's physical state: wear, losses, repairs and restoration. We prepare one for any work on request before purchase.",
  },
];

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Glossary</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-muted">
        Terms used in our catalogue descriptions, briefly explained.
      </p>

      <dl className="mt-8 divide-y divide-line-soft border-y border-line-soft">
        {terms.map(({ term, definition }) => (
          <div key={term} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="font-medium text-ink-heading">{term}</dt>
            <dd className="leading-relaxed text-ink-body">{definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
