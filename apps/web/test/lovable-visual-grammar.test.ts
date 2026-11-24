import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Cupertino Overview distinguishes national evidence, simulator math, and platform editions", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  assert.match(overview, /Health costs, finally clear\./);
  assert.match(overview, /bento-simulator/);
  assert.match(overview, /bento-reality/);
  assert.match(overview, /edition-pill-rail/);
  assert.match(overview, /COVERAGE_CATALOG\.map/);
  assert.match(overview, /calculateScenario\(teaserScenario\)/);
  assert.match(overview, /National descriptive · Not causal/);
  assert.match(overview, /Planning math · Not savings/);
  assert.doesNotMatch(overview, /style=\{\{/);
});

test("Cupertino Bento and Brief styles remain CSP-clean with zero inline styles", () => {
  const css = source("../src/pages/OverviewPage.css");
  assert.match(css, /\.bento-grid\s*\{/);
  assert.match(css, /letter-spacing:\s*-0\.045em/);
  const briefCss = source("../src/pages/BriefPage.css");
  assert.match(briefCss, /\.brief-executive-grid\s*\{/);
  assert.match(briefCss, /@media print\s*\{/);
});
