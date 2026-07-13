import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jvb/db", "@jvb/ui"],
};

export default nextConfig;
