import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JvB Capture",
    short_name: "Capture",
    description: "Quick capture — works, invoices, contacts",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ee",
    theme_color: "#faf9f5",
    icons: [
      { src: "/icons/capture-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/capture-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/capture-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
