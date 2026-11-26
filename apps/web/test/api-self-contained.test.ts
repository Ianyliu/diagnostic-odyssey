import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Vercel's Node builder (verified with @vercel/node 32.0.0 via `vercel build`) preserves the
 * `.ts` specifier of a local import but emits only `.js`, so a deployed function that imports a
 * sibling module fails at runtime with ERR_MODULE_NOT_FOUND. Every file in apps/web/api is a
 * public function and must therefore be fully self-contained (Node built-ins only).
 * See docs/adr/0003-vercel-api-functions-stay-self-contained.md.
 */
const apiDirectory = fileURLToPath(new URL("../api/", import.meta.url));
const apiFiles = readdirSync(apiDirectory).filter(name => /\.(?:ts|js|mjs)$/.test(name));

test("the api directory contains exactly the two known public functions", () => {
  assert.deepEqual(apiFiles.sort(), ["ai-guidance.ts", "ai-preview.ts"]);
});

for (const name of apiFiles) {
  test(`api/${name} has no local or package imports, only node: built-ins`, () => {
    const source = readFileSync(`${apiDirectory}${name}`, "utf8");
    const specifiers = [...source.matchAll(/(?:^|[\n;])\s*(?:import|export)\b[^'"`;]*?from\s*["']([^"']+)["']|(?:^|[\s(])import\(\s*["']([^"']+)["']\s*\)/g)]
      .map(match => match[1] ?? match[2]);
    for (const specifier of specifiers) {
      assert.match(specifier ?? "", /^node:/, `${name} imports "${specifier}", which Vercel will not trace into the function`);
    }
  });
}
