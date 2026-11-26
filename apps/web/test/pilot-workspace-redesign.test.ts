import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getSensitivityBarWidth } from "../src/data/sensitivityPresentation.ts";
import { readPilotFile, readPilotSource } from "./helpers/pilotSource.ts";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const pilot = readPilotSource();
const pilotCss = source("../src/pages/PilotPage.css");
const sensitivity = source("../src/components/SensitivityExplorer.tsx");
const sensitivityCss = source("../src/components/SensitivityExplorer.css");
const visualsCss = source("../src/components/PilotDecisionVisuals.css");

test("Pilot provides 3 strategy presets, synchronized sliders, and keeps selected context outside the form", () => {
  assert.match(pilot, /PILOT_STRATEGY_PRESETS\.map/);
  assert.match(pilot, /type="range"/);
  assert.match(pilot, /Four applied planning quantities/);
  assert.match(pilot, /Exposure difference/);

  // The attached-context section must live outside the assumptions form: it is a separate module,
  // is not inside the form markup, and is not rendered as a child of <AssumptionsForm>.
  const form = readPilotFile("pilot/AssumptionsForm.tsx");
  const formStart = form.indexOf('<form id="pilot-assumptions"');
  const formEnd = form.indexOf("</form>", formStart);
  assert.ok(formStart >= 0 && formEnd > formStart);
  assert.doesNotMatch(form.slice(formStart, formEnd), /pilot-context|ContextPanel/);
  assert.match(readPilotFile("pilot/ContextPanel.tsx"), /<section id="pilot-context"/);
  const page = readPilotFile("PilotPage.tsx");
  const assumptionsElement = page.match(/<AssumptionsForm[\s\S]*?\/>/);
  assert.ok(assumptionsElement, "AssumptionsForm must be a self-closing element with no children");
  assert.doesNotMatch(assumptionsElement[0], /ContextPanel/);
  assert.ok(page.indexOf("<ContextPanel") > page.indexOf("<AssumptionsForm"));
  assert.match(pilot, /context never alters numeric scenario math/);
});

test("Pilot results retain applied/draft boundary and all seven planning quantities", () => {
  assert.match(pilot, /Draft not applied/);
  assert.match(pilot, /last valid planning assumptions/);
  for (const label of [
    "Intended reach",
    "Reached participants",
    "Capacity gap",
    "Baseline person-months",
    "Planning person-months",
    "Difference in person-months",
    "Program-resource requirement"
  ]) {
    assert.match(pilot, new RegExp(label));
  }
  assert.match(pilot, /invalidDraft \? \(\s*<section id="sensitivity"/);
  assert.match(pilot, /disabled>Open Brief<\/button>/);
});

test("Pilot studio uses responsive Split Studio grid and container-responsive visuals", () => {
  for (const id of ["pilot-assumptions", "pilot-results", "sensitivity", "pilot-context"]) {
    assert.match(pilot, new RegExp(`id="${id}"`));
  }
  assert.match(pilotCss, /\.atlas-studio-grid/);
  assert.match(visualsCss, /@container pilot-result \(min-width: 540px\)/);
  assert.match(visualsCss, /@container pilot-result \(min-width: 780px\)/);
});

test("sensitivity zero is an actual zero-width SVG bar with a numeric table alternative", () => {
  assert.equal(getSensitivityBarWidth(0, 0), 0);
  assert.equal(getSensitivityBarWidth(0, 100), 0);
  assert.match(sensitivity, /width=\{width \* 10\}/);
  assert.doesNotMatch(sensitivity, /style=\{\{/);
  assert.match(sensitivity, /className="sensitivity-table-scroll" role="region"[^>]*tabIndex=\{0\}/);
  assert.match(sensitivity, /<caption>Mechanical one-way sensitivity values/);
  assert.match(sensitivity, /<th scope="row">/);
  assert.match(sensitivityCss, /\.sensitivity-table-scroll\s*\{[\s\S]*?overflow-x: auto/);
});

test("request creation retains a focusable control and offers a separate review link", () => {
  assert.match(sensitivity, /if \(!onUpsertDataRequest \|\| requestStatus === "current"\) return/);
  assert.match(sensitivity, /aria-disabled=\{requestStatus === "current"\}/);
  assert.match(sensitivity, /onClick=\{handleRequest\}/);
  assert.match(sensitivity, /<Link className="text-button" to="\/data-requests">\s*\{requestStatus === "current" \? "Review data request" : "Open Data Requests"\}\s*<\/Link>/);
  assert.match(sensitivity, /aria-describedby="sensitivity-brief-coverage"/);
  assert.match(sensitivity, /aria-live="polite" aria-atomic="true"/);
  assert.match(sensitivity, /New requests start selected in the Brief/);
});
