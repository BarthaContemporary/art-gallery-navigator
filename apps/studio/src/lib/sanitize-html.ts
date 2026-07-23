/**
 * Small allow-list-ish sanitiser for rich-text HTML fragments (maker
 * profiles, AI drafts): strips script/style/iframe blocks, event handlers
 * and javascript: URLs. Applied on save AND on any server-generated HTML
 * before it reaches a client that will innerHTML it.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "");
}
