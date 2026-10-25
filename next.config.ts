import type { NextConfig } from "next";

// Cache Components and Partial Prefetching are off: every page is private and
// rendered per request, and the root layout reads theme/locale cookies
// (ADR 0013). Tailwind runs through the Turbopack loader (no PostCSS config).
// See node_modules/next/dist/docs/.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
