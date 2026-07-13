# Sanity schemas

These are the content-model definitions for the public website. They are
plain TypeScript objects (no `sanity` package import) so they typecheck
inside `@jvb/web` without pulling the Studio toolchain into this app.

**The Sanity Studio itself is deployed separately** — either hosted via
sanity.io/manage, or run locally with `npx sanity dev` from a small Studio
project that imports `schemaTypes` from `sanity/schema.ts`, e.g.:

```ts
// sanity.config.ts (in the separate Studio project)
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "@jvb/web/sanity/schema"; // or a relative path

export default defineConfig({
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
```

Notes:

- `work` is **read-only**: documents are pushed from Supabase by the studio
  app's sync endpoint (`/api/sync/sanity`) with ids `work-{supabaseId}`.
  Unpublishing a piece in the inventory deletes the Sanity doc.
- `siteSettings` is a singleton — pin it in the Studio structure.
- Remember to configure the Sanity webhook (on create/update/delete of any
  type) to POST to `https://<site>/api/revalidate` with the shared secret
  `SANITY_REVALIDATE_SECRET`.
