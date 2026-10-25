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

const RAW_COLOR =
  "Use theme token classes (bg-surface, text-muted, …), not raw colors (ADR 0011).";

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
  {
    // CLI tools may use src/domain and src/lib only (relative imports).
    files: ["tools/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            githubAccess,
            {
              group: [
                "**/src/app",
                "**/src/app/**",
                "**/src/components",
                "**/src/components/**",
                "**/src/storage",
                "**/src/storage/**",
                "**/src/server",
                "**/src/server/**",
                "**/src/i18n",
                "**/src/i18n/**",
                "**/src/theme",
                "**/src/theme/**",
                "@/*",
              ],
              message:
                "tools/ may import only src/domain and src/lib, with relative paths.",
            },
          ],
        },
      ],
    },
  },
  {
    // Colors only via theme tokens (ADR 0011): no hex or color functions in UI code.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/#[0-9a-fA-F]{3}|rgba?[(]|hsla?[(]|okl[ac][bh][(]/]",
          message: RAW_COLOR,
        },
        {
          selector:
            "TemplateElement[value.raw=/#[0-9a-fA-F]{3}|rgba?[(]|hsla?[(]|okl[ac][bh][(]/]",
          message: RAW_COLOR,
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
