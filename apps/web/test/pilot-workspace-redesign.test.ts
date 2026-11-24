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

test("Pilot renders strategy presets, sliders, and keeps selected context outside the form", () => {
  assert.match(pilot, /PILOT_STRATEGY_PRESETS/);
  assert.match(pilot, /type="range"/);
  assert.match(pilot, /Four applied planning quantities/);
  assert.match(pilot, /Person-month delta/);
  assert.match(pilot, /Program-resource requirement/);

  const formStart = pilot.indexOf('<form');
  const formEnd = pilot.indexOf("</form>", formStart);
  const contextStart = pilot.indexOf('<section id="pilot-context"');
  assert.ok(formStart >= 0 && formEnd > formStart && contextStart > formEnd);
});

test("Pilot results retain applied/draft boundary and Boundary & Trace drawer", () => {
  assert.match(pilot, /Draft not applied/);
  assert.match(pilot, /last valid planning assumptions/);
  assert.match(pilot, /Boundary &amp; Trace/);
  assert.match(pilot, /Modeled pathway boundary/);
  assert.match(pilot, /DecisionTrace/);
  assert.match(pilot, /invalidDraft \? <section id="sensitivity"/);
  assert.match(pilot, /disabled>[\s\S]*?Review planning brief[\s\S]*?<\/button>/);
});

test("sensitivity zero omits zero-width SVG bars, has numeric table, and zero inline styles", () => {
  assert.equal(getSensitivityBarWidth(0, 0), 0);
  assert.equal(getSensitivityBarWidth(0, 100), 0);
  assert.doesNotMatch(sensitivity, /style=\{\{/);
  assert.match(sensitivity, /barW > 0 &&/);
  assert.match(sensitivity, /className="sensitivity-table-scroll"/);
  assert.match(sensitivity, /<caption>Mechanical one-way sensitivity values/);
  assert.match(sensitivity, /<th scope="row">/);
  assert.match(sensitivityCss, /\.sensitivity-table-scroll\s*\{[\s\S]*?overflow-x:\s*auto/);
});

test("request creation retains a focusable control and offers a separate review link", () => {
  assert.match(sensitivity, /if \(!onUpsertDataRequest \|\| requestStatus === "current"\) return/);
  assert.match(sensitivity, /aria-disabled=\{requestStatus === "current"\}/);
  assert.match(sensitivity, /onClick=\{handleRequest\}/);
  assert.match(sensitivity, /to="\/data-requests"/);
  assert.match(sensitivity, /aria-live="polite" aria-atomic="true"/);
  assert.match(sensitivity, /New requests start selected in Brief/);
});
