import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  async redirects() {
    return squarespaceRedirects()
      .filter((r) => r.source !== r.destination)
      .map((r) => ({ source: r.source, destination: r.destination, permanent: true }));
  },
};

export default nextConfig;
