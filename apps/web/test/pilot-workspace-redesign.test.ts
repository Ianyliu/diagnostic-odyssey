import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getSensitivityBarWidth } from "../src/data/sensitivityPresentation.ts";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const pilot = source("../src/pages/PilotPage.tsx");
const sensitivity = source("../src/components/SensitivityExplorer.tsx");
const sensitivityCss = source("../src/components/SensitivityExplorer.css");
const visuals = source("../src/components/PilotDecisionVisuals.tsx");

test("Pilot exposes presets, sliders, 4 KPIs, and keeps selected context outside the form", () => {
  assert.match(pilot, /PILOT_STRATEGY_PRESETS\.map/);
  assert.match(pilot, /type="range"/);
  assert.match(pilot, /Four applied planning quantities/);
  assert.match(pilot, /Exposure difference/);
  assert.match(pilot, /Visual Impact/);
  assert.match(pilot, /What-If Sensitivity/);
  assert.match(pilot, /Data Needs/);

  const formStart = pilot.indexOf('<form id="pilot-assumptions"');
  const formEnd = pilot.indexOf("</form>", formStart);
  const contextStart = pilot.indexOf('<section id="pilot-context"');
  assert.ok(formStart >= 0 && formEnd > formStart && contextStart > formEnd);
  assert.match(pilot, /Selecting one never alters numeric levers/);
});

test("Pilot results retain applied/draft boundary and all seven planning quantities", () => {
  assert.match(pilot, /Draft not applied/);
  for (const label of [
    "Intended reach",
    "Reached participants",
    "Capacity gap",
    "Baseline exposure",
    "Planning exposure",
    "Exposure difference",
    "Program budget"
  ]) {
    assert.match(pilot, new RegExp(label));
  }
  assert.match(pilot, /Sensitivity analysis paused/);
  assert.match(pilot, /disabled>Review planning brief<\/button>/);
});

test("Decision visuals and sensitivity use CSP-safe SVG geometry with zero inline styles", () => {
  assert.equal(getSensitivityBarWidth(0, 0), 0);
  assert.equal(getSensitivityBarWidth(0, 100), 0);
  assert.doesNotMatch(visuals, /style=\{\{/);
  assert.doesNotMatch(sensitivity, /style=\{\{/);
  assert.match(sensitivity, /<svg className="sensitivity-svg"/);
  assert.match(sensitivityCss, /\.sensitivity-bars\s*\{/);
  assert.match(sensitivity, /className="sensitivity-table-scroll" role="region"[^>]*tabIndex=\{0\}/);
  assert.match(sensitivity, /<caption>Mechanical one-way sensitivity values/);
  assert.match(sensitivity, /<th scope="row">/);
  assert.match(sensitivityCss, /\.sensitivity-table-scroll\s*\{[\s\S]*?overflow-x:\s*auto/);
});

test("request creation retains a focusable control and offers a separate review link", () => {
  assert.match(sensitivity, /if \(!onUpsertDataRequest \|\| requestStatus === "current"\) return/);
  assert.match(sensitivity, /aria-disabled=\{requestStatus === "current"\}/);
  assert.match(sensitivity, /onClick=\{handleRequest\}/);
  assert.match(sensitivity, /requestStatus === "current" && <Link className="text-button" to="\/data-requests">Review data request<\/Link>/);
  assert.match(sensitivity, /aria-live="polite" aria-atomic="true"/);
  assert.match(sensitivity, /New requests start selected in the Brief/);
});
