/*
 * For unit tests only: stand in for whole modules, by import specifier, so
 * `node --test` can load an API route and call its handler. The route's own
 * code and the pure modules it imports run as they are (with alias.ts, which
 * the test imports first); what needs a server around it (the cookie client,
 * the auth server, next/server, a PDF renderer) is replaced by a few lines
 * of module source, which reach the test's state through globalThis.
 *
 *   // @ts-ignore TS5097
 *   import "<...>/lib/test-support/alias.ts";
 *   // @ts-ignore TS5097
 *   import { fakeModules, NEXT_SERVER } from "<...>/lib/test-support/module-fakes.ts";
 *   fakeModules({ "next/server": NEXT_SERVER, "@/lib/supabase": `export const getSupabase = ...` });
 *   const { GET } = await import("./route.ts");
 *
 * Each test file runs in a process of its own, so the fakes stay in it.
 * Never imported by the app.
 */
import { registerHooks } from "node:module";

/** Load `source` (an ES module, no imports of its own) wherever `specifier` is imported. */
export function fakeModules(fakes: Record<string, string>): void {
  const urls = new Map(
    Object.entries(fakes).map(([specifier, source]) => [specifier, `data:text/javascript,${encodeURIComponent(source)}`]),
  );
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const url = urls.get(specifier);
      return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
    },
  });
}

/** next/server's NextResponse.json, which is all the routes use of it. */
export const NEXT_SERVER = `
export const NextResponse = {
  json: (body, init) =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    }),
};
`;
