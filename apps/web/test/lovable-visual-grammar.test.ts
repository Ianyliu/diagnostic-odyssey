import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Overview separates national evidence, local terrain, pilot simulation, and brief layers", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  for (const marker of [
    "National descriptive · Not causal",
    "State context · Not prevalence",
    "Planning math · Not savings",
    "Boundaries intact · Export ready"
  ]) {
    assert.ok(overview.includes(marker), `Missing boundary micro-caption: ${marker}`);
  }
});

test("Brief editorial changes remain scoped to the screen presentation", () => {
  const css = source("../src/pages/BriefPage.css");
  const section = css.split("/* Lovable-informed brief presentation; screen only")[1];
  assert.ok(section, "A distinct screen-only section is required");
  assert.match(section, /@media screen\s*\{/);
  assert.match(section, /\.planning-brief-page \.page-heading h1/);
  assert.match(section, /\.planning-brief-page \.brief-content/);
  const screenBlock = section.split("@media print")[0] ?? "";
  assert.doesNotMatch(screenBlock, /@media print/);
});

test("Obsidian landing tactical arc keeps all real stage routes with zero inline styles", () => {
  const overview = source("../src/pages/OverviewPage.tsx");
  const motionCss = source("../src/motion.css");
  assert.match(overview, /See where health costs break\. Move the right lever first\./);
  assert.match(overview, /tactical-arc-shell/);
  assert.match(overview, /monolith-strip/);
  for (const path of ["/burden", "/local-context", "/pilot", "/brief"]) {
    assert.ok(overview.includes(`to: "${path}"`), `Missing real destination: ${path}`);
  }
  assert.doesNotMatch(overview, /style=\{\{/);
  assert.match(motionCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(overview, /\[14200|\[7900/);
});
