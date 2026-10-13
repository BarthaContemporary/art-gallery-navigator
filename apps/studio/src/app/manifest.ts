import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JvdB - Studio",
    short_name: "JvdB - Studio",
    description: "Inventory · CRM · Website back office",
    start_url: "/",
    display: "standalone",
    // The page ground (tokens.css --jvb-page), so the splash screen and title
    // bar match the studio; the brand orange (#fc6600) lives in the icons only.
    // In dark mode the theme-color meta set by the root layout takes over.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/inventory-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/inventory-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/inventory-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
