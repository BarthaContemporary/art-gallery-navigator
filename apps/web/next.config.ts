import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTISTS_UNDER_CONSTRUCTION } from "./src/lib/site";

/**
 * Every URL the old Squarespace site had, mapped to its new home. Generated
 * by scripts/import-squarespace/parse.mjs into redirects/squarespace.json.
 * Permanent, so search rankings and old newsletter links carry over.
 */
function squarespaceRedirects(): { source: string; destination: string }[] {
  try {
    const raw = readFileSync(join(__dirname, "redirects", "squarespace.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (r): r is { source: string; destination: string } =>
            typeof r?.source === "string" && typeof r?.destination === "string",
        )
      : [];
  } catch {
    return [];
  }
}


/**
 * Security headers (ICO "appropriate technical measures", UK GDPR Art. 32).
 * HSTS keeps every visit on TLS; the rest stop content sniffing, framing by
 * other sites, referrer leakage and unneeded browser features. The CSP here
 * is deliberately limited to the directives that cannot break page scripts.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://challenges.cloudflare.com; object-src 'none'; upgrade-insecure-requests",
  },
];

const nextConfig: NextConfig = {
  // @jvb/db and @jvb/ui ship raw TypeScript / CSS source from the workspace.
  transpilePackages: ["@jvb/db", "@jvb/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // The previous information architecture: exhibitions now live under /events.
      { source: "/exhibitions", destination: "/", permanent: true },
      { source: "/exhibitions/:slug", destination: "/events/:slug", permanent: true },
      { source: "/visit", destination: "/about", permanent: true },
      { source: "/contact", destination: "/about", permanent: true },
      // Sections retired with the redesign; works are reached through events and artists.
      { source: "/works", destination: "/", permanent: true },
      // While the artist pages are being rebuilt, old work URLs go home instead.
      { source: "/works/:slug", destination: ARTISTS_UNDER_CONSTRUCTION ? "/" : "/artists", permanent: !ARTISTS_UNDER_CONSTRUCTION },
      { source: "/collections", destination: "/", permanent: true },
      { source: "/collections/:slug", destination: "/", permanent: true },
      { source: "/journal", destination: "/", permanent: true },
      { source: "/journal/:slug", destination: "/", permanent: true },
      ...squarespaceRedirects()
        .filter((r) => r.source !== r.destination)
        .map((r) => ({ source: r.source, destination: r.destination, permanent: true })),
    ];
  },
};

export default nextConfig;
