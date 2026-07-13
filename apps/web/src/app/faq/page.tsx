import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Collectors' FAQ",
  description:
    "Answers to common questions about buying Japanese and Indian works of art — condition, tomobako, provenance, shipping and prices.",
};

const faqs: { question: string; answer: string }[] = [
  {
    question: "How do I start collecting Japanese bronzes?",
    answer:
      "Buy the best single example you can rather than several lesser pieces. Handle works in person where possible: weight, surface and the crispness of the casting tell you more than photographs. A reputable dealer will always explain condition, later additions and any restoration before you commit.",
  },
  {
    question: "What is a tomobako, and why does it matter?",
    answer:
      "A tomobako is the original fitted wooden storage box made for a Japanese work of art, often inscribed and signed by the artist. A signed tomobako can confirm authorship and adds meaningfully to a work's documentation and value, so it should always be kept with the piece.",
  },
  {
    question: "What does 'POA' mean?",
    answer:
      "Price on application. Many galleries, including ours, do not publish prices online. Email us with the stock number or title of the work and we will reply promptly with the price and, if helpful, further photographs and a condition note.",
  },
  {
    question: "How is provenance documented?",
    answer:
      "Provenance is the ownership history of a work: previous collections, auction appearances, exhibitions and publications. Where it is known we list it on the work's page, and invoices record it permanently. Good provenance supports authenticity and can add value, but many fine works have simply remained quietly in private hands.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Yes. We pack and ship worldwide using specialist fine-art carriers, fully insured door to door. Works requiring UK export licences are handled by us as part of the sale. Shipping costs are quoted before you commit to a purchase.",
  },
  {
    question: "Can I view a work before buying?",
    answer:
      "Always. The gallery is open by appointment, and we are happy to bring selected works to major fairs where we exhibit. Use the booking page to arrange a private viewing.",
  },
  {
    question: "Do you buy works or accept consignments?",
    answer:
      "We are always interested in acquiring fine Japanese and Indian works of art, individually or as collections, and we take selected works on consignment. Send photographs and any documentation by email for an initial view.",
  },
  {
    question: "Are your descriptions and dates guaranteed?",
    answer:
      "Every work is sold with a full invoice description stating maker, date and medium as catalogued. If a work is subsequently shown to be materially misdescribed, we will take it back — collecting should be a pleasure, not a risk.",
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={faqJsonLd} />
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
        Collectors&rsquo; FAQ
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-muted">
        Common questions about buying and living with Japanese and Indian works of art. Terms in
        italics are explained further in the{" "}
        <Link
          href="/glossary"
          className="underline decoration-ink-separator underline-offset-2 hover:text-ink-strong"
        >
          glossary
        </Link>
        .
      </p>

      <div className="mt-8 divide-y divide-line-soft border-y border-line-soft">
        {faqs.map((faq) => (
          <section key={faq.question} className="py-6">
            <h2 className="font-medium text-ink-heading">{faq.question}</h2>
            <p className="mt-2 leading-relaxed text-ink-body">{faq.answer}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Something we haven&rsquo;t covered?{" "}
        <Link
          href="/contact"
          className="underline decoration-ink-separator underline-offset-2 hover:text-ink-strong"
        >
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
