/**
 * Newsletter block model + email-safe HTML compiler.
 *
 * The studio email designer edits a `NewsletterDesign` (an ordered list of
 * blocks). `compileNewsletter` renders it to table-based, inline-styled HTML
 * that survives Gmail/Outlook/Proton. The compiled HTML keeps two mail-merge
 * placeholders — `{{salutation}}` and `{{unsubscribe_url}}` — which are
 * substituted per recipient at send time (and with sample values for preview).
 *
 * Pure module (no React, no server imports) so it can run in the client
 * designer for live preview and on the server at send time.
 */

export type Block =
  | { id: string; type: "heading"; text: string; level?: 1 | 2 }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; url: string; alt?: string; href?: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size?: number }
  | { id: string; type: "works"; items: WorkItem[] };

export type WorkItem = {
  title: string;
  maker?: string;
  imageUrl?: string;
  url?: string;
  price?: string;
};

export type NewsletterDesign = { blocks: Block[] };

export type CompileContext = {
  galleryName: string;
  galleryAddress?: string;
  previewText?: string;
  /** Defaults to the {{salutation}} merge token; pass a real value for preview. */
  salutation?: string;
  /** Defaults to the {{unsubscribe_url}} merge token. */
  unsubscribeUrl?: string;
};

const SALUTATION_TOKEN = "{{salutation}}";
const UNSUB_TOKEN = "{{unsubscribe_url}}";

// Palette — mirrors the washi/sumi/oranje web design system, using email-safe
// font stacks (webfonts are unreliable in mail clients).
const C = {
  bg: "#EFEDE4",
  paper: "#FAF9F5",
  ink: "#1B1916",
  muted: "#6B675F",
  faint: "#9A968C",
  line: "#E2DED2",
  oranje: "#FC6600",
};
const SANS =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', 'Songti SC', serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Rich-ish text: escape, then honour blank-line paragraphs + single newlines. */
function renderText(text: string): string {
  const paras = text.trim().split(/\n{2,}/);
  return paras
    .map((p) => {
      const body = escapeHtml(p).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.65;color:${C.ink};">${body}</p>`;
    })
    .join("");
}

function renderBlock(b: Block): string {
  switch (b.type) {
    case "heading": {
      const size = b.level === 2 ? 20 : 26;
      const mt = b.level === 2 ? 8 : 4;
      return `<h${b.level === 2 ? 2 : 1} style="margin:${mt}px 0 12px;font-family:${SERIF};font-weight:400;font-size:${size}px;line-height:1.25;color:${C.ink};letter-spacing:-0.01em;">${escapeHtml(
        b.text,
      )}</h${b.level === 2 ? 2 : 1}>`;
    }
    case "text":
      return renderText(b.text);
    case "image": {
      const img = `<img src="${escapeHtml(b.url)}" alt="${escapeHtml(
        b.alt ?? "",
      )}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:6px 0 18px;" />`;
      return b.href
        ? `<a href="${escapeHtml(b.href)}" target="_blank" style="text-decoration:none;">${img}</a>`
        : img;
    }
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;"><tr><td bgcolor="${C.oranje}" style="border-radius:2px;"><a href="${escapeHtml(
        b.href,
      )}" target="_blank" style="display:inline-block;padding:11px 22px;font-family:${SANS};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">${escapeHtml(
        b.label,
      )}</a></td></tr></table>`;
    case "divider":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${C.line};font-size:0;line-height:0;height:1px;padding:10px 0;">&nbsp;</td></tr></table>`;
    case "spacer":
      return `<div style="height:${Math.max(4, Math.min(80, b.size ?? 20))}px;line-height:1px;font-size:1px;">&nbsp;</div>`;
    case "works":
      return renderWorks(b.items);
    default:
      return "";
  }
}

function renderWorks(items: WorkItem[]): string {
  if (!items?.length) return "";
  const cells = items
    .map((w) => {
      const inner = `
        ${
          w.imageUrl
            ? `<img src="${escapeHtml(w.imageUrl)}" alt="${escapeHtml(
                w.title,
              )}" width="256" style="display:block;width:100%;height:auto;border:0;margin-bottom:8px;" />`
            : ""
        }
        <div style="font-family:${SERIF};font-size:15px;line-height:1.35;color:${C.ink};">${escapeHtml(
          w.title,
        )}</div>
        ${
          w.maker
            ? `<div style="font-family:${SANS};font-size:12.5px;color:${C.muted};margin-top:2px;">${escapeHtml(
                w.maker,
              )}</div>`
            : ""
        }
        ${
          w.price
            ? `<div style="font-family:${SANS};font-size:12.5px;color:${C.ink};margin-top:2px;">${escapeHtml(
                w.price,
              )}</div>`
            : ""
        }`;
      const body = w.url
        ? `<a href="${escapeHtml(w.url)}" target="_blank" style="text-decoration:none;color:inherit;">${inner}</a>`
        : inner;
      return `<td width="50%" valign="top" style="padding:0 8px 20px;">${body}</td>`;
    })
    .join("");
  // Two-per-row grid.
  const rows: string[] = [];
  const arr = items.slice();
  const cellArr = cells.match(/<td[\s\S]*?<\/td>/g) ?? [];
  for (let i = 0; i < cellArr.length; i += 2) {
    rows.push(`<tr>${cellArr[i] ?? ""}${cellArr[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  }
  void arr;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px -8px 0;">${rows.join(
    "",
  )}</table>`;
}

export function compileNewsletter(
  design: NewsletterDesign,
  ctx: CompileContext,
): string {
  const salutation = ctx.salutation ?? SALUTATION_TOKEN;
  const unsub = ctx.unsubscribeUrl ?? UNSUB_TOKEN;
  const blocks = (design?.blocks ?? []).map(renderBlock).join("\n");
  const preheader = ctx.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
        ctx.previewText,
      )}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(ctx.galleryName)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.paper};">
      <tr><td style="padding:30px 32px 6px;">
        <div style="font-family:${SANS};font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:${C.ink};">${escapeHtml(
          ctx.galleryName,
        )}</div>
      </td></tr>
      <tr><td style="padding:0 32px;border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:22px 32px 8px;">
        <p style="margin:0 0 16px;font-family:${SERIF};font-size:16px;line-height:1.65;color:${C.ink};">${salutation},</p>
        ${blocks}
      </td></tr>
      <tr><td style="padding:14px 32px 30px;border-top:1px solid ${C.line};">
        <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};">
          ${escapeHtml(ctx.galleryName)}${
            ctx.galleryAddress ? ` · ${escapeHtml(ctx.galleryAddress)}` : ""
          }<br />
          You are receiving this because you asked to hear from us.
          <a href="${unsub}" style="color:${C.muted};">Unsubscribe</a>.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Substitute per-recipient merge tokens into already-compiled HTML. */
export function personalise(
  html: string,
  vars: { salutation: string; unsubscribeUrl: string },
): string {
  return html
    .split(SALUTATION_TOKEN)
    .join(escapeHtml(vars.salutation))
    .split(UNSUB_TOKEN)
    .join(vars.unsubscribeUrl);
}

export const NEWSLETTER_TOKENS = { SALUTATION_TOKEN, UNSUB_TOKEN };

export function emptyDesign(): NewsletterDesign {
  return {
    blocks: [
      {
        id: "b1",
        type: "text",
        text: "Write your message here. Use the blocks on the left to add headings, images, works and buttons.",
      },
    ],
  };
}
