// node --test apps/studio/src/app/login/auth-server-config.test.ts
// The sign-in pages rely on settings outside the app: the edge server's API
// block (infra/compose/Caddyfile) and the sign-in server's environment
// (infra/compose/docker-compose.yml). These checks keep them in step, so a
// later edit cannot quietly switch the sign-in limits off
// (docs/ops/security-runbook.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { SIGN_IN_LIMITS } from "./sign-in.ts";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

type Block = { header: string; body: string[] };

/** The Caddyfile's top-level blocks (sites and snippets), comments removed. */
function caddyBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let current: Block | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (depth === 0 && line.endsWith("{")) {
      current = { header: line.slice(0, -1).trim(), body: [] };
      blocks.push(current);
    } else if (current) {
      current.body.push(line);
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth === 0) current = null;
  }
  assert.equal(depth, 0, "Caddyfile braces balance");
  return blocks;
}

const toGateway = /^reverse_proxy\s+(?:https?:\/\/)?(?:127\.0\.0\.1|localhost|\[::1\]):8000\b/;

function composeValue(compose: string, name: string): string | null {
  const m = new RegExp(`^\\s+${name}:\\s*"?([^"\\n]*)"?\\s*$`, "m").exec(compose);
  return m?.[1]?.trim() ?? null;
}

test("the gateway is proxied only through the supabase_api snippet", () => {
  const blocks = caddyBlocks(read("infra/compose/Caddyfile"));
  const snippet = blocks.find((b) => b.header === "(supabase_api)");
  assert.ok(snippet, "Caddyfile defines (supabase_api)");
  for (const block of blocks) {
    const proxies = block.body.filter((l) => toGateway.test(l));
    if (block === snippet) assert.equal(proxies.length, 1, "the snippet proxies to the gateway once");
    else assert.deepEqual(proxies, [], `${block.header} proxies to 127.0.0.1:8000 itself; import supabase_api instead`);
  }
  const importers = blocks.filter((b) => b.body.includes("import supabase_api"));
  assert.ok(importers.length >= 1, "an API site imports supabase_api");
  for (const site of importers) {
    assert.ok(!site.header.startsWith("("), "imported by sites, not by other snippets");
    assert.ok(site.body.includes("import security_headers"), `${site.header} also imports security_headers`);
    assert.ok(!site.body.some((l) => /^reverse_proxy\b/.test(l)), `${site.header} proxies only through the snippet`);
  }
});

test("the snippet names the caller and closes the code emails", () => {
  const snippet = caddyBlocks(read("infra/compose/Caddyfile")).find((b) => b.header === "(supabase_api)")!;
  assert.ok(snippet.body.includes("header_up X-JVB-Client-IP {remote_host}"));
  const matcher = snippet.body.find((l) => l.startsWith("@auth_code_email path "));
  assert.ok(matcher, "@auth_code_email matcher");
  for (const p of ["/auth/v1/recover*", "/auth/v1/otp*", "/auth/v1/magiclink*", "/auth/v1/resend*", "/auth/v1/signup*"]) {
    assert.ok(matcher.split(/\s+/).includes(p), p);
  }
  assert.ok(snippet.body.some((l) => /^respond @auth_code_email\b.*\b403$/.test(l)), "closed with a 403");
});

test("GoTrue counts by the header Caddy sets, and leaves room for session refreshes", () => {
  const compose = read("infra/compose/docker-compose.yml");
  const header = /header_up\s+(\S+)\s+\{remote_host\}/.exec(read("infra/compose/Caddyfile"))?.[1];
  assert.equal(composeValue(compose, "GOTRUE_RATE_LIMIT_HEADER")?.toLowerCase(), header?.toLowerCase());
  // token also carries every refresh the studio and capture servers make
  // from Vercel's shared addresses; GoTrue's default is 150 per 5 minutes.
  assert.ok(Number(composeValue(compose, "GOTRUE_RATE_LIMIT_TOKEN_REFRESH")) >= 150);
  // What both apps pass on in 5 minutes is at most a fifth of it.
  assert.ok(2 * SIGN_IN_LIMITS.app.max * 5 <= Number(composeValue(compose, "GOTRUE_RATE_LIMIT_TOKEN_REFRESH")));
  assert.equal(composeValue(compose, "GOTRUE_SECURITY_CAPTCHA_ENABLED"), "${AUTH_CAPTCHA_ENABLED:-false}");
});

test("emailed links live as long as the invitation email says", () => {
  const exp = Number(composeValue(read("infra/compose/docker-compose.yml"), "GOTRUE_MAILER_OTP_EXP"));
  assert.ok(exp > 0, "GOTRUE_MAILER_OTP_EXP is set");
  const promise = /expires in (\d+) hours/.exec(read("apps/studio/src/app/(app)/admin/page.tsx"));
  if (promise) assert.equal(exp, Number(promise[1]) * 3600, `Admin's invitation says ${promise[1]} hours`);
});

test("no app asks GoTrue for the code emails Caddy closes", () => {
  const closed = /\.auth\.(resetPasswordForEmail|signInWithOtp|signUp|resend)\s*\(/;
  for (const app of ["studio", "capture", "web"]) {
    const dir = new URL(`apps/${app}/src/`, root);
    for (const file of readdirSync(dir, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(file) || file.endsWith(".test.ts")) continue;
      const m = closed.exec(readFileSync(new URL(file, dir), "utf8"));
      assert.equal(m, null, `apps/${app}/src/${file} calls auth.${m?.[1]}, which the edge server answers with 403`);
    }
  }
});
