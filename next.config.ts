import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ship the Prisma query engine with standalone/serverless output so the
  // production bundle can actually talk to Postgres (Neon). Without this,
  // Next.js tree-shaking can drop the engine binary from the trace.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/*.node", "./node_modules/@prisma/client/runtime/*.node"],
  },
};

export default nextConfig;
