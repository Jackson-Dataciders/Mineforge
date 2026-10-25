import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Layer boundaries from docs/architecture.md, enforced at lint time.
const githubAccess = {
  group: ["@octokit/*", "octokit"],
  message: "GitHub API access belongs in src/storage or src/server only.",
};
const storageAndServer = {
  group: ["@/storage", "@/storage/*", "@/server", "@/server/*"],
  message:
    "Components never touch storage or server code; go through a route handler or server component.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx,mts,mjs}"],
    ignores: ["src/storage/**", "src/server/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [githubAccess] }],
    },
  },
  {
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [githubAccess, storageAndServer] },
      ],
    },
  },
  {
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            githubAccess,
            storageAndServer,
            {
              group: [
                "@/app",
                "@/app/*",
                "@/components",
                "@/components/*",
                "react",
                "react-dom",
                "next",
                "next/*",
                "node:*",
              ],
              message:
                "src/domain is pure TypeScript: no I/O, React or framework imports.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
