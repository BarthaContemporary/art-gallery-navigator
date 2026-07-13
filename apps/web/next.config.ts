import type { NextConfig } from "next";

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
};

export default nextConfig;
