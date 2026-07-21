import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JvdB - Studio",
    short_name: "JvdB - Studio",
    description: "Inventory · CRM · Website back office",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#faf9f5",
    icons: [
      { src: "/icons/inventory-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/inventory-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/inventory-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
