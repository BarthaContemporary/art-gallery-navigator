import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schema";

/**
 * Joost van den Bergh — content studio.
 * Editorial content (exhibitions, publications, pages, site settings) lives
 * here; `work` documents are synced read-only from the Supabase inventory.
 */
export default defineConfig({
  name: "jvb",
  title: "Joost van den Bergh",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "s1r6wzwb",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
