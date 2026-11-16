import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Overview distinguishes reviewed national and local sources, assumptions, and gaps", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  for (const marker of [
    "overview-role-grid",
    "overview-role-card reviewed",
    "overview-role-card context",
    "overview-role-card assumption",
    "overview-role-card gap",
    "Reviewed survey estimates retain their population",
    "They do not create local illness-burden estimates.",
    "not observations or measured intervention effects.",
    "when the analyst chooses to include them."
  ]) {
    assert.ok(overview.includes(marker), `Missing semantic presentation: ${marker}`);
  }
});

test("Visual grammar uses scoped, redundant patterns and existing scientific tokens", () => {
  const css = source("../src/pages/OverviewPage.css");
  assert.match(css, /\.overview-role-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /\.overview-role-card\.assumption::before\s*\{[\s\S]*?repeating-linear-gradient/);
  assert.match(css, /\.overview-role-card\.gap\s*\{[\s\S]*?border-style:\s*dashed/);
  assert.match(css, /\.overview-value-prop \.overview-section-heading h2\s*\{[\s\S]*?--do-font-editorial/);
});

test("Brief editorial changes remain scoped to the screen presentation", () => {
  const css = source("../src/pages/BriefPage.css");
  const section = css.split("/* Lovable-informed brief presentation; screen only")[1];
  assert.ok(section, "A distinct screen-only experimental section is required");
  assert.match(section, /@media screen\s*\{/);
  assert.match(section, /\.planning-brief-page \.page-heading h1/);
  assert.match(section, /\.planning-brief-page \.brief-content/);
  assert.doesNotMatch(section, /@media print/);
});

test("Lovable landing structure is primary and keeps the real four-stage routes", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  const css = source("../src/pages/OverviewPage.css");
  const journey = source("../src/components/LandingJourney.tsx");
  const journeyCss = source("../src/components/LandingJourney.css");
  assert.match(overview, /Chart the road from/);
  assert.match(overview, /<LandingJourney \/>/);
  assert.match(overview, /overview-hero-journey/);
  assert.match(overview, /overview-two-lenses/);
  assert.match(overview, /overview-closing/);
  assert.match(overview, /<OpeningProvenance playing=\{opening\.playing\}/);
  assert.match(css, /\.overview-page \.overview-hero\s*\{[\s\S]*grid-template-areas:/);
  for (const path of ["/burden", "/local-context", "/pilot", "/data-requests", "/brief"]) {
    assert.ok(journey.includes(`to: "${path}"`), `Missing real destination: ${path}`);
  }
  assert.match(journey, /n: "Optional", to: "\/data-requests"/);
  assert.match(journeyCss, /\.lovable-journey-mobile/);
  assert.doesNotMatch(journey, /style=\{\{/);
  assert.match(journeyCss, /\.lovable-journey-stop-0\s*\{\s*left:/);
  assert.match(journeyCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(overview, /\[14200|\[7900/);
});
