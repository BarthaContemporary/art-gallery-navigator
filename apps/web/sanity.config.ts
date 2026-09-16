import { defineConfig } from "sanity";
import { structureTool, type StructureResolver } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schema";
import { CatalogueBrowser } from "./sanity/components/CatalogueBrowser";

/**
 * Joost van den Bergh — content studio.
 * Editorial content (exhibitions, publications, pages, site settings) lives
 * here; `work` documents are synced read-only from the Supabase inventory.
 */

// Sidebar: the site's content types in reading order, Site settings pinned
// as a singleton, and a flat "Catalogue" browser over the historical works
// that live inside each exhibition.
const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.documentTypeListItem("exhibition").title("Events (exhibitions & fairs)"),
      S.listItem()
        .title("Catalogue (all exhibitions)")
        .id("catalogue-browser")
        .child(S.component(CatalogueBrowser).id("catalogue-browser").title("Catalogue")),
      S.documentTypeListItem("publication").title("Publications"),
      S.documentTypeListItem("page").title("Pages"),
      S.divider(),
      S.documentTypeListItem("work").title("Works (from the inventory)"),
      S.documentTypeListItem("artist").title("Artists (from the inventory)"),
      S.divider(),
      S.listItem()
        .title("Site settings")
        .id("siteSettings")
        // Pinned to the one Site settings document that exists (created in the
        // Studio on 15 Sep 2026) so the sidebar never opens a second, empty one.
        .child(S.document().schemaType("siteSettings").documentId("602103fd-d2f9-4938-9b7f-8af768cfd65b")),
    ]);

export default defineConfig({
  name: "jvb",
  title: "Joost van den Bergh",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "dql8z4kv",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool({ structure }), visionTool()],
  schema: { types: schemaTypes },
});
