import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**", // the e2e servers' dist dirs (playwright.config.ts)
    ".next-e2e-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext's Cloudflare build output (`npm run cf:build`) and Wrangler's local state.
    ".open-next/**",
    ".wrangler/**",
    // Vendored as is: a subset of the Stageshow kit (MIT), used by the About page's demo (src/components/about).
    "src/components/about/stageshow/**",
    // Cloudflare Workers (workers/stats): their own runtime types, checked with wrangler (AGENTS.md), not the app's config.
    "workers/**",
  ]),
]);

export default eslintConfig;
