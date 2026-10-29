import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Ship the Prisma query engine with standalone/serverless output so the
  // production bundle can actually talk to Postgres (Neon).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/*.node",
      "./node_modules/@prisma/client/runtime/*.node",
      "./node_modules/@prisma/engines/*",
    ],
  },
};

export default nextConfig;
