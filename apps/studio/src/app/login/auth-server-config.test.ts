// node --test apps/studio/src/app/login/auth-server-config.test.ts
// The sign-in pages rely on settings outside the app: the edge server's API
// snippet (infra/compose/Caddyfile) and the sign-in server's environment
// (infra/compose/docker-compose.yml), both copied into the owner's runbook
// (docs/ops/security-runbook.md, appendices A and B). These checks keep them
// in step, so a later edit cannot quietly switch the sign-in limits off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { SIGN_IN_LIMITS } from "./sign-in.ts";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** One Caddyfile line, with the block it opens (null for a plain line). */
type Directive = { line: string; children: Directive[] | null };

/** The Caddyfile as a tree of directives, comments and blank lines removed. */
function caddyTree(text: string): Directive[] {
  const top: Directive[] = [];
  const stack: Directive[][] = [top];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "}") {
      assert.ok(stack.length > 1, "Caddyfile braces balance");
      stack.pop();
    } else if (line.endsWith("{")) {
      const node: Directive = { line: line.slice(0, -1).trim(), children: [] };
      stack.at(-1)!.push(node);
      stack.push(node.children!);
    } else {
      stack.at(-1)!.push({ line, children: null });
    }
  }
  assert.equal(stack.length, 1, "Caddyfile braces balance");
  return top;
}

/** Every line under `nodes`, at any depth. */
function allLines(nodes: Directive[]): string[] {
  return nodes.flatMap((n) => [n.line, ...allLines(n.children ?? [])]);
}

/** A node as plain data, for comparing shapes. */
type Shape = string | { [line: string]: Shape[] };
const shape = (n: Directive): Shape => (n.children ? { [n.line]: n.children.map(shape) } : n.line);

const toGateway = /^reverse_proxy\s+(?:https?:\/\/)?(?:127\.0\.0\.1|localhost|\[::1\]):8000\b/;
const caddy = () => caddyTree(read("infra/compose/Caddyfile"));
const snippetOf = (tree: Directive[]) => tree.find((n) => n.line === "(supabase_api)");

function composeValue(compose: string, name: string): string | null {
  const m = new RegExp(`^\\s+${name}:\\s*"?([^"\\n]*)"?\\s*$`, "m").exec(compose);
  return m?.[1]?.trim() ?? null;
}

/** The first fenced code block after `heading` in a Markdown text. */
function codeBlockAfter(markdown: string, heading: string): string {
  const from = markdown.indexOf(heading);
  assert.ok(from >= 0, `runbook has "${heading}"`);
  const m = /```[a-z]*\n([\s\S]*?)\n```/.exec(markdown.slice(from));
  assert.ok(m, `a code block follows "${heading}"`);
  return m[1] ?? "";
}

test("the gateway is proxied only through the supabase_api snippet", () => {
  const tree = caddy();
  const snippet = snippetOf(tree);
  assert.ok(snippet, "Caddyfile defines (supabase_api)");
  for (const block of tree) {
    if (block === snippet) continue;
    const proxies: string[] = allLines(block.children ?? []).filter((l) => toGateway.test(l));
    assert.deepEqual(proxies, [], `${block.line} proxies to 127.0.0.1:8000 itself; import supabase_api instead`);
  }
  const importers = tree.filter((b) => (b.children ?? []).some((c) => c.line === "import supabase_api"));
  assert.ok(importers.length >= 1, "an API site imports supabase_api");
  for (const site of importers) {
    assert.ok(!site.line.startsWith("("), "imported by sites, not by other snippets");
    const lines = (site.children ?? []).map((c) => c.line);
    assert.ok(lines.includes("import security_headers"), `${site.line} also imports security_headers`);
    assert.ok(!allLines(site.children ?? []).some((l) => /^(reverse_proxy|handle|route)\b/.test(l)), `${site.line} proxies only through the snippet`);
  }
});

test("the snippet closes the code emails, leaves renewals uncounted and counts everything else", () => {
  const snippet = snippetOf(caddy())!;
  // Exactly this shape. The renewal matcher must read the grant as GoTrue's
  // Token handler does (r.FormValue: a form or multipart body before the
  // URL, the first value of each): a looser one, such as `header
  // Content-Type application/json*` (any of several Content-Type headers),
  // could let a password sign-in through without the address, uncounted.
  // A change here needs the same change in the runbook's Appendix B and a
  // fresh look at that reasoning (infra/compose/Caddyfile).
  assert.deepEqual(snippet.children!.map(shape), [
    "@auth_code_email path /auth/v1/recover* /auth/v1/otp* /auth/v1/magiclink* /auth/v1/resend* /auth/v1/signup*",
    { "handle @auth_code_email": ['respond "Not available" 403'] },
    {
      "@refresh_grant": [
        "path /auth/v1/token",
        'expression `{query.grant_type} == "refresh_token" && {header.Content-Type}.matches("^application/json(;[^,]*)?$")`',
      ],
    },
    { "handle @refresh_grant": [{ "reverse_proxy 127.0.0.1:8000": ["header_up -X-JVB-Client-IP"] }] },
    { handle: [{ "reverse_proxy 127.0.0.1:8000": ["header_up X-JVB-Client-IP {remote_host}"] }] },
  ]);
});

test("the renewal matcher's pattern accepts what the Supabase client sends and nothing looser", () => {
  // The Caddyfile's own pattern (RE2 there; this one reads the same in
  // JavaScript), run on the Content-Type value Caddy hands it: several
  // headers arrive joined with commas.
  const source = /\{header\.Content-Type\}\.matches\("([^"]+)"\)/.exec(read("infra/compose/Caddyfile"))?.[1];
  assert.ok(source, "the renewal matcher checks Content-Type");
  const json = new RegExp(source);
  for (const ok of ["application/json;charset=UTF-8", "application/json", "application/json; charset=utf-8"]) assert.ok(json.test(ok), ok);
  for (const no of [
    "",
    "application/x-www-form-urlencoded",
    "application/x-www-form-urlencoded,application/json",
    "application/json,application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "APPLICATION/X-WWW-FORM-URLENCODED",
    "text/plain;application/json",
  ]) {
    assert.ok(!json.test(no), no);
  }
});

test("GoTrue counts by the header Caddy sets, and password sign-ins are held to 30 per 5 minutes", () => {
  const compose = read("infra/compose/docker-compose.yml");
  const header = /header_up\s+(\S+)\s+\{remote_host\}/.exec(read("infra/compose/Caddyfile"))?.[1];
  assert.equal(composeValue(compose, "GOTRUE_RATE_LIMIT_HEADER")?.toLowerCase(), header?.toLowerCase());
  assert.ok(read("infra/compose/Caddyfile").includes(`header_up -${header}`), "renewals drop the same header");
  const token = Number(composeValue(compose, "GOTRUE_RATE_LIMIT_TOKEN_REFRESH"));
  // What both apps pass on in 5 minutes fits.
  assert.ok(2 * SIGN_IN_LIMITS.app.max <= token, `GOTRUE_RATE_LIMIT_TOKEN_REFRESH ${token} leaves room for both apps' sign-ins`);
  // Renewals are not counted (Caddyfile), so a larger number would only let
  // password guessing sent straight to GoTrue through faster.
  assert.ok(token <= 30, `GOTRUE_RATE_LIMIT_TOKEN_REFRESH ${token} is above 30`);
  assert.equal(composeValue(compose, "GOTRUE_SECURITY_CAPTCHA_ENABLED"), "${AUTH_CAPTCHA_ENABLED:-false}");
});

test("emailed links live as long as the invitation email says", () => {
  const exp = Number(composeValue(read("infra/compose/docker-compose.yml"), "GOTRUE_MAILER_OTP_EXP"));
  assert.ok(exp > 0, "GOTRUE_MAILER_OTP_EXP is set");
  const promise = /expires in (\d+) hours/.exec(read("apps/studio/src/app/(app)/admin/page.tsx"));
  assert.ok(
    promise,
    "Admin's invitation email (apps/studio/src/app/(app)/admin/page.tsx) no longer says \"expires in N hours\": update this test to read its new wording, and keep GOTRUE_MAILER_OTP_EXP matching it",
  );
  assert.equal(exp, Number(promise[1]) * 3600, `Admin's invitation says ${promise[1]} hours`);
});

test("no app asks GoTrue for the code emails Caddy closes", () => {
  const closed = [
    /\.auth\.(resetPasswordForEmail|signInWithOtp|signUp|resend)\s*\(/,
    /\/auth\/v1\/+(recover|otp|magiclink|resend|signup)\b/i,
  ];
  for (const app of ["studio", "capture", "web"]) {
    const dir = new URL(`apps/${app}/src/`, root);
    for (const file of readdirSync(dir, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(file) || file.endsWith(".test.ts")) continue;
      const text = readFileSync(new URL(file, dir), "utf8");
      for (const pattern of closed) {
        const m = pattern.exec(text);
        assert.equal(m, null, `apps/${app}/src/${file} uses ${m?.[0]}, which the edge server answers with 403`);
      }
    }
  }
});

test("the runbook's appendices are the repository's settings, word for word", () => {
  const runbook = read("docs/ops/security-runbook.md");
  const compose = read("infra/compose/docker-compose.yml").split("\n");
  const first = compose.findIndex((l) => l.startsWith("      # --- Guessing limits"));
  const last = compose.findIndex((l) => l.startsWith("      GOTRUE_SECURITY_CAPTCHA_SECRET:"));
  assert.ok(first > 0 && last > first, "docker-compose.yml has the guessing-limits block");
  assert.equal(
    codeBlockAfter(runbook, "## Appendix A"),
    compose.slice(first, last + 1).join("\n"),
    "runbook Appendix A must match the block in infra/compose/docker-compose.yml",
  );
  const caddyfile = read("infra/compose/Caddyfile").split("\n");
  const open = caddyfile.indexOf("(supabase_api) {");
  const close = caddyfile.indexOf("}", open);
  assert.ok(open > 0 && close > open, "Caddyfile has the supabase_api snippet");
  assert.equal(
    codeBlockAfter(runbook, "## Appendix B"),
    caddyfile.slice(open, close + 1).join("\n"),
    "runbook Appendix B must match (supabase_api) in infra/compose/Caddyfile",
  );
});
