# Dependency overrides

`pnpm audit` is kept at zero (the CI `audit` job fails on any advisory). Where
a package we depend on still asks for a vulnerable version of something it
uses, and no release of that package fixes it, the root `package.json` forces
the fixed version under `pnpm.overrides`. JSON has no comments, so each entry
is explained here. Written 6 November 2026, when `pnpm audit` went from 94
advisories to none.

Rules for an override: the narrowest selector that works (a parent, `a>b`, or
the vulnerable range only, `b@<x.y.z`); the same major unless every release
of that major is affected; and a test that the parent still works. Remove an
entry once the parent ships a release with the fix: delete it, run
`pnpm install` and `pnpm audit`, and keep the deletion if the audit stays
clean.

| Override | Why | Remove when |
|---|---|---|
| `@module-federation/dts-plugin>undici` → `^7.30.1` | The Sanity CLI's workbench (`@sanity/workbench-cli` → `@module-federation/vite` → `dts-plugin` 2.9.2) pins undici 7.29.1 exactly: 8 undici advisories below 7.30.1. Same major. | `@module-federation/dts-plugin` stops pinning undici below 7.30.1 |
| `@oclif/core>minimatch` → `^11.0.5` | GHSA-g3hv-75wg-m249 covers every minimatch 10.x; even the newest `@oclif/core` (the Sanity CLI's command framework) asks for ^10.2.5. It only calls `minimatch(name, pattern)`, which 11 still exports. Crosses a major because all of 10.x is affected. | `@oclif/core` accepts minimatch 11 |
| `@vercel/frameworks>js-yaml` → `^3.15.2` | `@sanity/cli` 8.27 pins `@vercel/frameworks` 3.29.0, which pins js-yaml 3.13.1 exactly (five js-yaml 3.x advisories). Stays on 3.x, which keeps the `safeLoad()` it calls. | `@vercel/frameworks` (via `@sanity/cli`) moves off 3.13.1 |
| `@vercel/frameworks>smol-toml` → `^1.9.1` | The same parent pins smol-toml 1.5.2 exactly (three advisories, fixed in 1.9.0). Same major. | as above |
| `brace-expansion@<1.1.21` → `^1.1.21` | Shared transitive package (exceljs → archiver → glob 7 → minimatch 3, and others): five advisories, fixed in 1.1.21. One override per major. | every parent resolves to a fixed 1.x by itself |
| `brace-expansion@>=2.0.0 <2.1.7` → `^2.1.7` | The same five advisories in 2.x (archiver, filelist, glob 10). | as above, for 2.x |
| `brace-expansion@>=5.0.0 <5.0.12` → `^5.0.12` | The same five advisories in 5.x (rimraf 6 → glob 13, minimatch 10). | as above, for 5.x |
| `browserslist@>=4.0.0 <4.28.7` → `^4.28.7` | Two advisories in 4.28.6; every parent (babel, core-js-compat, next's styled-jsx) accepts ^4.24, so only an override moves it. Also brings a fixed `baseline-browser-mapping`. | parents require ≥4.28.7 (they may never; harmless to keep) |
| `dompurify@>=3.0.0 <3.4.17` → `^3.4.17` | Sanity 6.22 → isomorphic-dompurify 2.36 asks for ^3.3.1, and pnpm would reuse a vulnerable 3.4.12 (one critical advisory). Only vulnerable 3.x copies are rewritten. | harmless to keep; remove if isomorphic-dompurify requires ≥3.4.17 |
| `exceljs>uuid` → `^11.1.1` | exceljs 4.4.0 (latest) asks for uuid ^8.3.0; GHSA-w5hq-g745-h8pq has no 8.x fix. exceljs only does `require('uuid').v4`, which uuid 11's CommonJS build still exports (checked: writing and re-reading an .xlsx with a data-bar format, the code path that calls it). | exceljs moves to uuid ≥11.1.1 |
| `nanoid@>=3.0.0 <3.3.18` → `^3.3.18` | GHSA-2v37-7h3g-55p8; Sanity packages accept 3.3.16. nanoid 5.x is untouched. | harmless to keep |
| `next>postcss` → `^8.5.32` | Next 15.5.29 (the last 15.x) pins postcss 8.4.31 exactly: four advisories. Same major as the apps' own postcss, so the tree holds one postcss. | the site moves to a Next release that drops the pin (Next 16) |
| `react-email>glob` → `^14.0.2` | `react-email` 6 (the email templates in `packages/emails`) brings glob ^13; GHSA-3g3m-2fjr-6pw4 covers glob 9.0.0 to 14.0.1, so 14.0.2 is the only fix. Only react-email's command-line tool, which nothing here runs, loads glob. | react-email requires glob ≥14.0.2 |
| `sharp@<0.35.5` → `^0.35.5` | sharp below 0.35.5 has advisories in its image library (libvips, librsvg). Next 15.5.29 keeps sharp as an optional dependency (^0.34.3 or ^0.35.5) and would otherwise keep a 0.34.x copy. | harmless to keep |
| `source-map-js@>=1.0.0 <1.2.2` → `^1.2.2` | GHSA-68fv-2mgg-jv7q; `@tailwindcss/node` (latest) and css-tree accept 1.2.1. Same major. | harmless to keep |
| `tar@>=7.0.0 <7.5.21` → `^7.5.21` | `@sanity/cli` 8.27 asks for tar ^7.5.18 and pnpm would reuse a vulnerable 7.5.20. Only vulnerable 7.x copies are rewritten. | harmless to keep |

## The upgrade of 6 November 2026, in short

- **Next.js** 15.5.20 → 15.5.29 in all three apps (critical cache-poisoning
  advisory, fixed from 15.5.21). Still Next 15. Tailwind 4.3.4, postcss 8.5.32.
- **Sanity Studio** (`apps/web`, a development dependency for the hosted
  Studio) 3.99 → 6.22, `@sanity/ui` 4, `@sanity/vision` 6. The only way to
  drop `decompress` (critical, no fixed release), which Sanity's CLI used up
  to version 4. The website no longer uses `next-sanity` (no release fits
  Next 15 with Sanity 6): `createClient` comes from `@sanity/client` (the
  same function next-sanity re-exported) and the revalidate webhook checks
  its signature with `@sanity/webhook`. The hosted Studio changes only when
  someone runs `pnpm exec sanity deploy` from `apps/web` (Node 22.12 or
  newer).
- **zod** 3 → 4 (no fixed 3.x). The website forms answer exactly as before:
  `apps/web/src/lib/form-messages.ts` keeps Zod 3's wording for visitors,
  and its tests pin the messages and the email addresses accepted.
- **sharp** 0.34 → 0.35.5 (studio and image worker). New default: an original
  with more than 5 colour channels is refused ("Input image exceeds channel
  limit"); re-save such a file flattened, as RGB.
- **sanitize-html** 2.18.1, **resend** 6 with `@react-email/render` 2, and
  `packages/emails` on `react-email` 6 (the component packages it replaces
  are deprecated).
