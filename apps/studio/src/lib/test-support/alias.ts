/*
 * For unit tests only: lets `node --test` load studio modules that import
 * each other through the "@/" alias (tsconfig paths), which Node itself does
 * not know. Import this first, then load the module under test with a
 * dynamic import(), so the hook is in place before its imports resolve:
 *
 *   // @ts-ignore TS5097
 *   import "./test-support/alias.ts";
 *   const { resolveListPieceIds } = await import("./list-members.ts");
 *
 * Only .ts modules resolve (Node strips types but cannot compile JSX), and
 * only modules whose imports are .ts or type-only can be loaded this way.
 * Never imported by the app.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = path.join(SRC, specifier.slice(2));
      for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
