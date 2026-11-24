import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Overview separates national evidence, local terrain, and editions without blending", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  for (const marker of [
    "atlas-lenses-grid",
    "atlas-lens-card is-national",
    "atlas-lens-card is-local",
    "Never blended",
    "National descriptive · Not causal"
  ]) {
    assert.ok(overview.includes(marker), `Missing semantic presentation: ${marker}`);
  }
});

test("Brief editorial styling avoids hiding content during print", () => {
  const css = source("../src/pages/BriefPage.css");
  assert.match(css, /\.atlas-memo-shell/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /\.atlas-memo-body\s*\{[^}]*display:\s*none/i);
});

test("Scroll story landing structure keeps real four-stage routes and zero AI-teal", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  const journey = source("../src/components/LandingJourney.tsx");
  const journeyCss = source("../src/components/LandingJourney.css");
  assert.match(overview, /What does chronic illness/);
  assert.match(overview, /<LandingJourney \/>/);
  assert.match(overview, /atlas-inset-stage/);
  assert.match(overview, /atlas-lenses-grid/);
  assert.match(overview, /atlas-closing-band/);
  for (const path of ["/burden", "/local-context", "/pilot", "/data-requests", "/brief"]) {
    assert.ok(journey.includes(`to: "${path}"`), `Missing real destination: ${path}`);
  }
  assert.match(journey, /n: "Optional", to: "\/data-requests"/);
  assert.match(journeyCss, /\.atlas-journey-mobile/);
  assert.doesNotMatch(journey, /style=\{\{/);
  assert.match(journeyCss, /\.atlas-journey-stop-0\s*\{\s*left:/);
  assert.match(journeyCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(overview, /\[14200|\[7900/);
  assert.doesNotMatch(journeyCss, /#0f7476|#2a9d9f|#58c3bd|#276b54|#3f765f|#2c6b58/i);
});
