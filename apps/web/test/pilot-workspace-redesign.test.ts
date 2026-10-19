import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getSensitivityBarWidth } from "../src/data/sensitivityPresentation.ts";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const pilot = source("../src/pages/PilotPage.tsx");
const pilotCss = source("../src/pages/PilotPage.css");
const sensitivity = source("../src/components/SensitivityExplorer.tsx");
const sensitivityCss = source("../src/components/SensitivityExplorer.css");
const visualsCss = source("../src/components/PilotDecisionVisuals.css");

test("Pilot groups editable assumptions and keeps selected context outside the form", () => {
  for (const group of ["Population and reach", "Delivery and timing", "Program resources"]) {
    assert.match(pilot, new RegExp(group));
  }
  assert.match(pilot, /<fieldset className="pilot-assumption-group"/);
  assert.match(pilot, /formatAppliedAssumption\(scenario, field\)/);
  assert.match(pilot, /forceOpen=/);
  assert.match(pilot, /<SensitivityPreview scenario=\{scenario\} paused=\{invalidDraft\}/);
  assert.match(pilot, /Four applied planning quantities/);
  assert.match(pilot, /Person-month exposure difference/);
  assert.equal((pilot.match(/fields: \[/g) ?? []).length, 3);

  const formStart = pilot.indexOf('<form id="pilot-assumptions"');
  const formEnd = pilot.indexOf("</form>", formStart);
  const contextStart = pilot.indexOf('<section id="pilot-context"');
  assert.ok(formStart >= 0 && formEnd > formStart && contextStart > formEnd);
  assert.match(pilot, /does not alter reach, capacity, timing, cost, pathway, or mechanism parameters/);
});

test("Pilot results retain applied/draft boundary and all seven planning quantities", () => {
  assert.match(pilot, /Draft not applied/);
  assert.match(pilot, /last valid planning assumptions/);
  for (const label of [
    "Intended reach",
    "Reached participants",
    "Capacity gap",
    "Baseline person-month exposure",
    "Planning person-month exposure",
    "Difference in person-month exposure",
    "Program-resource requirement"
  ]) {
    assert.match(pilot, new RegExp(label));
  }
  assert.match(pilot, /invalidDraft \? <section id="sensitivity"/);
  assert.match(pilot, /disabled>Review planning brief<\/button>/);
});

test("Pilot section navigation is selective and result visuals respond to their container", () => {
  for (const id of ["pilot-assumptions", "pilot-results", "sensitivity", "pilot-context", "pilot-trace"]) {
    assert.match(pilot, new RegExp(`(?:href="#${id}"|id="${id}")`));
  }
  assert.match(pilotCss, /@media \(min-width: 1200px\) and \(min-height: 800px\)/);
  assert.match(pilotCss, /\.pilot-section-nav \{\s*position: sticky/);
  assert.match(pilotCss, /\.pilot-page \.result-card \{[\s\S]*?container: pilot-result \/ inline-size/);
  assert.match(visualsCss, /@container pilot-result \(min-width: 540px\)/);
  assert.match(visualsCss, /@container pilot-result \(min-width: 780px\)/);
});

test("sensitivity zero is an actual zero-width mark with a numeric table alternative", () => {
  assert.equal(getSensitivityBarWidth(0, 0), 0);
  assert.equal(getSensitivityBarWidth(0, 100), 0);
  assert.match(sensitivity, /style=\{\{width: `\$\{width\}%`\}\}/);
  const fillRule = sensitivityCss.match(/\.sensitivity-fill \{([^}]+)\}/)?.[1] ?? "";
  assert.doesNotMatch(fillRule, /min-width/);
  assert.match(sensitivity, /className="sensitivity-table-scroll" role="region"[^>]*tabIndex=\{0\}/);
  assert.match(sensitivity, /<caption>Mechanical one-way sensitivity values/);
  assert.match(sensitivity, /<th scope="row">/);
  assert.match(sensitivityCss, /\.sensitivity-table-scroll \{[\s\S]*?overflow-x: auto/);
});

test("request creation retains a focusable control and offers a separate review link", () => {
  assert.match(sensitivity, /if \(!onUpsertDataRequest \|\| requestStatus === "current"\) return/);
  assert.match(sensitivity, /aria-disabled=\{requestStatus === "current"\}/);
  assert.match(sensitivity, /onClick=\{handleRequest\}/);
  assert.match(sensitivity, /requestStatus === "current" && <Link className="text-button" to="\/data-requests">Review data request<\/Link>/);
  assert.match(sensitivity, /aria-live="polite" aria-atomic="true"/);
  assert.match(sensitivity, /New requests start selected in the Brief/);
});
