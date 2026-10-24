import type { NextRequest } from "next/server";
import groq from "groq";
import { imageUrl, sanityFetch, workBySlugQuery, type CatalogueEntry, type SanityImage, type Work } from "@/lib/sanity";
import { clientIp } from "@/lib/form-fields";

/*
 * What the gallery's enquiry notification says about the work and about
 * where the enquiry came from (app/api/enquiry/route.ts).
 *
 * The work is looked up here from what the form names (a work's slug, or a
 * past show's catalogue entry by its key), never taken from the browser, so
 * the details and the picture in the email are the published ones.
 *
 * The origin (time, IP address, the town, region and country Vercel derives
 * from that address, the browser and the page) goes into the email only: it
 * is not stored with the enquiry or on the contact. The Privacy Notice and
 * ROPA (activity 1) say so.
 */

export type EnquiryWorkRef = { source: "work" | "catalogue"; id: string };

type Detail = { label: string; value: string };

export type EnquiryWork = {
  heading: string;
  image: string | null;
  /** The larger picture the email's image links to. */
  imageFull: string | null;
  details: Detail[];
  /** The record in the Studio, when the work is stock. */
  studioUrl: string | null;
};

const STUDIO_ORIGIN = (process.env.STUDIO_URL ?? "https://studio.joostvandenbergh.com").replace(/\/+$/, "");

const catalogueEntryQuery = groq`*[_type == "exhibition" && $id in catalogue[]._key][0]{
  title,
  "entry": catalogue[_key == $id][0]{
    _key, image{ asset, caption }, reference, title, maker, makerDates, medium, originAndDate, dimensions, sold
  }
}`;

function pictures(image: SanityImage | null | undefined) {
  return {
    // Fitted inside 1120 x 840 (twice the email's 560 x 420), so a tall
    // work does not fill the whole screen.
    image: imageUrl(image, { width: 1120, height: 840, quality: 80 }),
    imageFull: imageUrl(image, { width: 2400, quality: 85 }),
  };
}

function rows(pairs: [string, string | null | undefined][]): Detail[] {
  return pairs
    .filter((p): p is [string, string] => typeof p[1] === "string" && p[1].trim() !== "")
    .map(([label, value]) => ({ label, value: value.trim() }));
}

/** The work an enquiry names, as published; null when it cannot be found. */
export async function enquiryWork(ref: EnquiryWorkRef | undefined): Promise<EnquiryWork | null> {
  if (!ref) return null;
  if (ref.source === "work") {
    const w = await sanityFetch<Work | null>({ query: workBySlugQuery, params: { slug: ref.id }, tags: ["work"], fallback: null });
    if (!w) return null;
    const maker = w.artist?.name ?? w.maker;
    const native = w.artist?.nameNative ?? w.makerNative ?? null;
    return {
      heading: [maker, w.title || "Untitled"].filter(Boolean).join(", "),
      ...pictures(w.images?.[0]),
      details: rows([
        ["Stock number", w.stockNumber],
        ["Maker", [maker, native, w.makerLifeDates ? `(${w.makerLifeDates})` : null].filter(Boolean).join(" ")],
        ["Title", w.title],
        ["Date", w.year ?? w.period],
        ["Origin", w.originRegion],
        ["Category", w.category],
        ["Medium", w.medium],
        ["Dimensions", w.dimensionsDisplay],
        ["Price", w.priceDisplay],
        ["Availability", w.available === false ? "Sold" : w.available ? "Available" : null],
        ["Description", w.description],
        ["Provenance", w.provenance],
        ["Literature", w.literature],
      ]),
      studioUrl: w.stockNumber ? `${STUDIO_ORIGIN}/inventory/${encodeURIComponent(w.stockNumber)}` : null,
    };
  }
  const found = await sanityFetch<{ title: string | null; entry: CatalogueEntry | null } | null>({
    query: catalogueEntryQuery,
    params: { id: ref.id },
    tags: ["exhibition"],
    fallback: null,
  });
  const c = found?.entry;
  if (!c) return null;
  return {
    heading: [c.maker, c.title || "Untitled"].filter(Boolean).join(", "),
    ...pictures(c.image),
    details: rows([
      ["Reference", c.reference],
      ["Maker", [c.maker, c.makerDates ? `(${c.makerDates})` : null].filter(Boolean).join(" ")],
      ["Title", c.title],
      ["Origin and date", c.originAndDate],
      ["Medium", c.medium],
      ["Dimensions", c.dimensions],
      ["Availability", c.sold ? "Sold" : null],
      ["Shown in", found?.title],
    ]),
    studioUrl: null,
  };
}

/** One request header, decoded where Vercel URL-encodes it (the city). */
function header(req: NextRequest, name: string): string | null {
  const raw = req.headers.get(name)?.trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * Where and when the enquiry was sent from. The address and the location
 * headers are the ones Vercel sets at its edge (a visitor cannot supply
 * them); the location is Vercel's estimate from the address and can be
 * wrong, a VPN's exit for instance.
 */
export function enquiryOrigin(req: NextRequest, at: Date): Detail[] {
  const ip = clientIp(req.headers);
  const city = header(req, "x-vercel-ip-city");
  const region = header(req, "x-vercel-ip-country-region");
  const country = countryName(header(req, "x-vercel-ip-country"));
  const zone = header(req, "x-vercel-ip-timezone");
  const london = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "long" }).format(at);
  let theirTime: string | null = null;
  if (zone && zone !== "Europe/London") {
    try {
      theirTime = `${new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(at)} (${zone})`;
    } catch {
      theirTime = null;
    }
  }
  const place = [city, region, country].filter(Boolean).join(", ");
  return rows([
    ["Sent", london],
    ["Their local time", theirTime],
    ["IP address", ip],
    ["Estimated location", place || null],
    ["Browser", req.headers.get("user-agent")?.slice(0, 300)],
    ["Page", req.headers.get("referer")?.slice(0, 500)],
  ]);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Text with its line breaks kept, escaped for the HTML part. */
const para = (s: string) => esc(s).replace(/\r?\n/g, "<br>");

const isUrl = (s: string) => /^https:\/\/[^\s"<>]+$/.test(s);

function table(details: Detail[]): string {
  return details
    .map(
      (d) =>
        `<tr><td style="padding:6px 16px 6px 0;vertical-align:top;color:#767676;white-space:nowrap;font-size:13px">${esc(d.label)}</td>` +
        `<td style="padding:6px 0;vertical-align:top;color:#1a1a1a;font-size:14px">${
          isUrl(d.value) ? `<a href="${esc(d.value)}" style="color:#b8430a">${esc(d.value)}</a>` : para(d.value)
        }</td></tr>`,
    )
    .join("");
}

function section(title: string, body: string): string {
  return (
    `<h2 style="margin:28px 0 8px;padding-top:16px;border-top:1px solid #ebe8e2;font-size:12px;font-weight:600;` +
    `letter-spacing:0.06em;text-transform:uppercase;color:#767676">${esc(title)}</h2>${body}`
  );
}

export function enquiryEmail({
  heading,
  message,
  enquirer,
  work,
  origin,
  fallbackSubject,
}: {
  heading: string;
  message: string;
  enquirer: Detail[];
  work: EnquiryWork | null;
  origin: Detail[];
  /** The form's own label of the work, when the work itself is not found. */
  fallbackSubject: string | null;
}): { html: string; text: string } {
  const workHtml = work
    ? section(
        "The work",
        (work.image
          ? `<a href="${esc(work.imageFull ?? work.image)}"><img src="${esc(work.image)}" alt="${esc(work.heading)}" ` +
            `style="display:block;width:auto;height:auto;max-width:100%;max-height:420px;border:0;margin:0 0 12px"></a>`
          : "") +
          `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${table(work.details)}</table>` +
          (work.studioUrl
            ? `<p style="margin:12px 0 0;font-size:14px"><a href="${esc(work.studioUrl)}" style="color:#b8430a">Open the record in the Studio</a></p>`
            : ""),
      )
    : fallbackSubject
      ? section("The work", `<p style="margin:0;font-size:14px;color:#1a1a1a">${para(fallbackSubject)}</p>`)
      : "";

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#444444">` +
    `<div style="max-width:560px;margin:0 auto">` +
    `<h1 style="margin:0 0 16px;font-size:20px;font-weight:400;color:#1a1a1a">${esc(heading)}</h1>` +
    `<p style="margin:0;font-size:15px;line-height:1.5;color:#1a1a1a">${para(message)}</p>` +
    section("From", `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${table(enquirer)}</table>`) +
    workHtml +
    section(
      "Sent from",
      `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${table(origin)}</table>`,
    ) +
    `</div></body></html>`;

  const block = (title: string, details: Detail[]) =>
    [title.toUpperCase(), ...details.map((d) => `${d.label}: ${d.value}`)].join("\n");
  const text = [
    heading,
    "",
    message,
    "",
    block("From", enquirer),
    "",
    work
      ? [block("The work", work.details), work.image ? `Picture: ${work.imageFull ?? work.image}` : null, work.studioUrl ? `Studio record: ${work.studioUrl}` : null]
          .filter(Boolean)
          .join("\n")
      : fallbackSubject
        ? `THE WORK\n${fallbackSubject}`
        : null,
    "",
    block("Sent from", origin),
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { html, text };
}
