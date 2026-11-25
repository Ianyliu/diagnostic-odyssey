import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

/**
 * Sources that belong to a TypeScript project, so type-aware rules can run.
 * `project` lists every tsconfig that owns some of these files; apps/web is split
 * into browser (src), server (api, build, src/server) and test configurations.
 * Files outside these globs (for example tests/browser fixtures) still get the
 * non-type-aware rules below.
 */
const typedSources = [
  "apps/web/{src,api,build,test}/**/*.{ts,tsx}",
  "apps/web/vite.config.ts",
  "packages/*/{src,test}/**/*.{ts,tsx}"
];
const typedProjects = [
  "apps/web/tsconfig.json",
  "apps/web/tsconfig.server.json",
  "apps/web/tsconfig.test.json",
  "packages/*/tsconfig.json"
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "coverage/**",
      "work/**",
      "data/raw/**",
      "data/intermediate/**",
      "artifacts/generated/**",
      // Untracked local tooling state (see .git/info/exclude); never part of the repository.
      ".maintenance-local/**",
      ".kilo/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // `x == null` is the idiomatic null-or-undefined check; everything else must use ===.
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Still off: 179 pre-existing explicit `any` (mostly security-sensitive API code and
      // mirrored sources). Tightening is tracked as technical debt, not done in a
      // behavior-preserving maintenance pass.
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    // Plain Node ES modules that rely on ambient Node globals.
    files: ["eslint.config.mjs", "scripts/verify/**/*.mjs", "tests/unit/**/*.mjs"],
    languageOptions: { globals: globals.node }
  },
  {
    files: typedSources,
    languageOptions: {
      parserOptions: {
        project: typedProjects,
        tsconfigRootDir: rootDir
      }
    },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error"
    }
  },
  {
    // node:test registers tests with un-awaited `test(...)` calls by design.
    files: ["**/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off"
    }
  }
);
