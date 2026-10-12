import type { MetadataRoute } from "next";
import { fallbackGalleryName } from "@/lib/site";

/**
 * Web app manifest (served at /manifest.webmanifest), used when the site is
 * added to a phone's home screen. Icons are the "Moon Gate" mark: ink
 * #1c1b18, paper #f6f4ee, seal #fc6600. The favicon, the SVG icon and the
 * Apple touch icon sit beside this file as favicon.ico, icon.svg and
 * apple-icon.png, which Next links from every page itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: fallbackGalleryName,
    short_name: fallbackGalleryName,
    start_url: "/",
    display: "standalone",
    theme_color: "#1c1b18",
    background_color: "#f6f4ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
