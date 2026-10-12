# SEO: content tasks for the gallery (October 2026)

The code side of the SEO work is live. Every page now has a description, a
title of the right length, a share image and structured data for Google.
Events carry dates and venues, artists their life dates, catalogues their
details, and works their maker and medium. The rest depends on content that
only the gallery can write or check. In order of value:

Where a field lives matters: artist and work details are edited in the
**studio** (the website sync overwrites them in Sanity); events, catalogues,
pages and Site settings are edited in **Sanity Studio**
(joostvandenbergh.sanity.studio).

## 1. Before Frieze Masters opens (Wednesday 14 October)

Sanity → Events → "chūshōteki - Frieze Masters 2026":

- **SEO → Title:** clear it. The site now strips the repeated gallery name
  itself, but an empty field is cleaner.
- **Venue:** "The Regent's Park, London". The stand number already has its
  own field.
- **Private views → "General Admission Last Day":** its end time is on
  17 October, before it starts. Set it to Sunday 18 October.
- **Slideshow images:** give each a short caption naming what is shown (for
  example "Stand B03 at Frieze Masters 2026, with works by SHIRAGA Kazuo and
  TANAKA Atsuko"). The caption becomes the image description for search
  engines and screen readers.
- Do not change the page address (slug) this week.

Then in Search Console:

1. Test the page at https://search.google.com/test/rich-results with
   `https://www.joostvandenbergh.com/events/chush-teki-frieze-masters-2026`.
   It should show a valid Event and Breadcrumbs.
2. URL Inspection → Request indexing for that page, the home page and
   `/publications`.
3. Sitemaps → resubmit `https://www.joostvandenbergh.com/sitemap.xml`.

## 2. Site settings (Sanity → Site settings)

- **Tagline:** "Twentieth-century Japanese art and Indian art, London". It
  describes the gallery to search engines and AI assistants.
- **Statement headline:** the About page's heading is just "About". For
  example: "Japanese and Indian art in London since 1988" (from your About
  text).
- **About teaser:** if filled, it appears as a short paragraph on the home
  page, which today has no text for search engines. Leave it empty if you
  prefer the home page without text. A draft built only from your About page:
  "Based in London since 1988, Joost van den Bergh deals in Asian art:
  twentieth-century Japanese art – metal vessels, bamboo, lacquer, ceramics,
  Mingei and Gutai painting – and Indian tantric and devotional art, shown at
  TEFAF Maastricht and Asian Art in London. Visits by appointment."
- **Phone:** only if you want it public. It then shows on About and in the
  gallery's search listing. (Check the number; the old site's isn't verified.)
- **Socials:** add any public profile pages that describe the gallery (fair
  exhibitor pages, Artsy, trade associations). They tell Google these
  profiles are the same gallery.
- **Company details:** legal name, company number and registered office, if
  the business is a company (also on the go-live list).

## 3. Event introductions and catalogue descriptions

28 of 29 events have no introduction and none of the 39 catalogues has a
description. Where one exists, it becomes the page's search description in
place of the sentence the site builds from dates and venue.

- Sanity → Events → each event → **Introduction**: two to four factual
  sentences (what was shown, which makers, when and where). Start with the
  TEFAF shows (2023–2026), then the Indian shows (Tantra, Magic Markings,
  Perfect Presence, Kalu Ram, Double Take).
- Sanity → Publications → each catalogue → **Description**: one or two
  sentences on the subject and the makers. Start with the twelve catalogues
  that have no event page.

## 4. Artists (in the studio, Makers)

- **Biographies:** 68 artists have none. 33 of them have nothing else either
  (no works, no shows), so those pages are kept out of Google and the sitemap
  for now. Each returns by itself once it has a biography or a work.
  60–120 words, facts only: born, place, training, recognition, when the
  gallery showed the work.
- **Native name** (kanji) where known, e.g. 濱田庄司 for HAMADA Shoji. It is
  added to the search data as an alternative name.
- **Duplicates and spelling:** merge or hide "Eiichi Kanamori" (into
  KANAMORI Eiichi) and "Shinobu Tsuda" (into TSUDA Shinobu). Correct
  "Watanebe Tadashi", "Nishikawa Mistuo", "SEIJI Kunishima" (KUNISHIMA Seiji),
  "ZENZO Sakamoto" (SAKAMOTO Zenzo) and the other names in house style. **Tell
  me the old and new page addresses** before or as you rename, and I add
  redirects in the same release so no link breaks.
- Catalogue entries name makers in free text, so fix the same spellings in
  the event catalogues in Sanity (e.g. 41 entries read "Watanebe Tadashi").

## 5. Catalogue entries on event pages (Sanity → Events → Catalogue)

- At TEFAF 2024 and 2025, 65 entries read "Untitled" because the object's
  name landed in the Medium or Origin field during import (e.g. Medium
  "Bamboo ikebana basket"). Move the name to Title and keep only the material
  in Medium. I can prepare a list of all 65 for review.
- Several shows have Medium and Origin swapped (Shrinathji, Objects of
  Worship, Select, one Shiraga Kazuo entry reading "1993"). The search data
  already ignores a "medium" that is really a date or place, but the visible
  captions still show it.
- Ten imported shows have no work titles at all; fill them from the
  catalogues where you can.

## 6. Event details (Sanity → Events)

- Six events have no dates, so they cannot appear as events in Google:
  Select, What Grows Here?, Tantric Drawings, Japanese 20th Century Design,
  Japanese Design of the 20th Century, Indian and Japanese Works.
- Venue "Gallery" on older shows: replace with the real place where known.
- Kalu Ram's subtitle has two fields run together.

## Later

- 297 catalogue entries point to artist records that no longer exist (all 55
  Kalu Ram entries among them). Switching the maker's web visibility back on
  in the studio recreates the page; ask me for the list.
- Create the TEFAF Maastricht 2027 event as soon as the dates and stand are
  known, so Google can list it weeks ahead.
- Frieze Masters 2025 has a catalogue page but no event page.
