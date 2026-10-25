import type { NextConfig } from "next";

// Defaults from create-next-app 16.4 (cacheComponents, partialPrefetching,
// Tailwind via the Turbopack loader). See node_modules/next/dist/docs/.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
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
