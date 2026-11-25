import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { longCovidAdapter, mecfsAdapter } from "@diagnostic-odyssey/condition-adapters";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { COVERAGE_CATALOG } from "../src/data/coverageCatalog.ts";
import { PILOT_STRATEGY_PRESETS, createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { workspaceStageForPath, workspaceStages } from "../src/data/workspaceNavigation.ts";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("coverage catalog grounds Edition 01 and upcoming modules in condition adapters with zero fabricated numbers", () => {
  const live = COVERAGE_CATALOG.find(entry => entry.status === "live");
  assert.ok(live);
  assert.equal(live.compatibilityStatus, longCovidAdapter.compatibility_status);
  assert.match(live.sourceHighlights.join(" "), /21 reviewed measures/);
  assert.match(live.sourceHighlights.join(" "), /34 access & shortage indicators/);

  const mecfs = COVERAGE_CATALOG.find(entry => entry.id === mecfsAdapter.condition_id);
  assert.ok(mecfs);
  assert.notEqual(mecfs.status, "live");
  assert.equal(mecfs.compatibilityStatus, "partial_compatibility");
  assert.deepEqual(mecfs.sourceHighlights, []);

  for (const planned of COVERAGE_CATALOG.filter(entry => entry.status !== "live")) {
    assert.deepEqual(planned.sourceHighlights, []);
    assert.match(planned.whyNotBorrowed, /never borrowed/i);
  }
});

test("three Pilot strategy presets compute valid deterministic scenarios including a live capacity gap stress test", () => {
  assert.equal(PILOT_STRATEGY_PRESETS.length, 3);
  const base = createPlanningScenarioDefaults();
  const byId = new Map(PILOT_STRATEGY_PRESETS.map(preset => [preset.id, preset]));

  const clinic = calculateScenario({...base, ...byId.get("focused-clinic-pilot")!.values});
  assert.equal(clinic.reached_participants, 600);
  assert.equal(clinic.capacity_gap, 0);

  const regional = calculateScenario({...base, ...byId.get("regional-navigation-program")!.values});
  assert.equal(regional.reached_participants, 3000);
  assert.equal(regional.capacity_gap, 0);

  const stress = calculateScenario({...base, ...byId.get("high-demand-stress-test")!.values});
  assert.equal(stress.intended_reach, 6300);
  assert.equal(stress.reached_participants, 3000);
  assert.equal(stress.capacity_gap, 3300);
});

test("standardized navigation, Prompt Studio route, ThemeControl, and CSP-clean UI contracts hold", () => {
  assert.deepEqual(workspaceStages.map(stage => stage.label), [
    "Burden",
    "Local context",
    "Strategy Lab",
    "Planning Brief"
  ]);
  assert.equal(workspaceStageForPath("/advisor"), null);
  assert.equal(workspaceStageForPath("/concept/future-ai"), null);

  const shell = readSource("../src/components/AppShell.tsx");
  assert.match(shell, /\/diagnostic-odyssey-mark\.svg/);
  assert.match(shell, /<ThemeControl \/>/);
  assert.match(shell, /<EditionDrawer/);

  const app = readSource("../src/App.tsx");
  assert.match(app, /path="concept\/future-ai"/);
  assert.match(app, /path="advisor"/);

  const pilot = readSource("../src/pages/PilotPage.tsx");
  for (const field of ["reach", "capacity", "alternative_window_months", "per_participant_cost"]) {
    assert.match(pilot, new RegExp(`key:\\s*"${field}"`));
  }
  assert.match(pilot, /type="range"/);
  assert.match(pilot, /Planning math · Not savings or ROI/);

  const brief = readSource("../src/pages/BriefPage.tsx");
  assert.match(brief, /Long COVID burden and pilot planning brief/);
  assert.match(brief, /COVERAGE_EDITION_BADGE/);

  const aiHandoff = readSource("../src/components/AiHandoff.tsx");
  assert.match(aiHandoff, /STARTER_CHIPS/);
  assert.match(aiHandoff, /Analyze with AI/);

  for (const file of [
    "../src/components/AiHandoff.tsx",
    "../src/components/AppShell.tsx",
    "../src/pages/OverviewPage.tsx",
    "../src/pages/BurdenPage.tsx",
    "../src/pages/LocalContextPage.tsx",
    "../src/pages/PilotPage.tsx",
    "../src/pages/DataRequestsPage.tsx",
    "../src/pages/BriefPage.tsx",
    "../src/concept/FutureAIExperiencePage.tsx"
  ]) {
    assert.doesNotMatch(readSource(file), /style=\{\{/, `${file} must not use inline style={{}}`);
  }
});
