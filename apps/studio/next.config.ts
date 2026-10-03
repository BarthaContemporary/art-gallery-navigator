import type { NextConfig } from "next";


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
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@jvb/db", "@jvb/ui"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
