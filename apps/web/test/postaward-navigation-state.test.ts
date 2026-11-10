import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  workspaceCompanionForPath,
  workspaceCompanions,
  workspaceStageForPath,
  workspaceStages
} from "../src/data/workspaceNavigation.ts";

const shell = readFileSync(fileURLToPath(new URL("../src/components/AppShell.tsx", import.meta.url)), "utf8");
const brief = readFileSync(fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)), "utf8");
const navigationCss = readFileSync(fileURLToPath(new URL("../src/components/WorkspaceNavigation.css", import.meta.url)), "utf8");
const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");

test("the four-stage workflow and its route mapping are unchanged", () => {
  assert.equal(workspaceStages.length, 4);
  assert.deepEqual(workspaceStages.map(stage => stage.to), ["/burden", "/local-context", "/pilot", "/brief"]);
  assert.equal(workspaceStageForPath("/burden/medical"), "/burden");
  assert.equal(workspaceStageForPath("/evidence"), "/burden");
  assert.equal(workspaceStageForPath("/data-requests"), "/pilot");
  assert.equal(workspaceStageForPath("/local-context"), "/local-context");
  assert.equal(workspaceStageForPath("/pilot"), "/pilot");
  assert.equal(workspaceStageForPath("/brief"), "/brief");
  assert.equal(workspaceStageForPath("/concept/future-ai"), "/brief");
  assert.equal(workspaceStageForPath("/"), null);
});

test("data requests is a persistent companion entry, not a fifth numbered stage", () => {
  assert.deepEqual(workspaceCompanions.map(entry => entry.to), ["/data-requests"]);
  assert.equal(workspaceCompanions[0].label, "Data requests");
  assert.equal(workspaceCompanionForPath("/data-requests"), "/data-requests");
  assert.equal(workspaceCompanionForPath("/pilot"), null);
  assert.equal(workspaceCompanionForPath("/burden"), null);
  // The companion destination is a real route.
  assert.match(app, /path="data-requests" element=\{<DataRequestsPage \/>/);
  // It is rendered in the persistent primary navigation (AppShell wraps every route).
  assert.match(shell, /id="primary-navigation"/);
  assert.match(shell, /workspaceCompanions\.map\(\(\{to, label, shortLabel\}\) => \(/);
  const companionMarkup = shell.match(/workspaceCompanions\.map[\s\S]*?<\/NavLink>/);
  assert.ok(companionMarkup, "companion entry renders inside the primary nav");
  assert.doesNotMatch(companionMarkup[0], /stage-number/);
  // The numbered stages keep their badges.
  assert.match(shell, /<span className="stage-number" aria-hidden="true">\{index \+ 1\}<\/span>/);
  // The existing secondary navigation stays available.
  assert.match(shell, /aria-label="Supporting navigation"/);
  assert.match(shell, /<Link to="\/data-requests">Data requests<\/Link>/);
});

test("the companion indicates the active route on its own page without double-highlighting a stage", () => {
  assert.match(shell, /const activeCompanion = workspaceCompanionForPath\(location\.pathname\)/);
  assert.match(shell, /const activeStage = activeCompanion === null \? workspaceStageForPath\(location\.pathname\) : null/);
});

test("the shell surfaces session/per-tab state with an export path to the brief before leaving", () => {
  assert.match(shell, /className="session-state-note" role="note"/);
  assert.match(shell, /Planning inputs are session state/);
  assert.match(shell, /stay in this browser tab/);
  assert.match(shell, /not saved as project storage/);
  assert.match(shell, /<Link to="\/brief">Open the Planning Brief<\/Link>/);
});

test("the JSON companion is clearly not a restorable saved scenario", () => {
  assert.match(brief, /The JSON companion is a shareable record of this Planning Brief, not a saved scenario\. It does not reopen or restore your planning state\./);
  // The export action and canonical serialization are untouched.
  assert.match(brief, /<button className="button" onClick=\{exportJson\}>Export JSON companion<\/button>/);
  assert.match(brief, /serializeBriefJson\(brief\)/);
});

test("the mobile bottom bar keeps the companion visible at narrow widths", () => {
  assert.match(navigationCss, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(navigationCss, /\.app-shell \.primary-nav a\.companion \{ padding-left: 8px; \}/);
});
