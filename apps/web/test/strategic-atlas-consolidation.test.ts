import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { PILOT_STRATEGY_PRESETS } from "../src/data/planningScenarioDefaults.ts";
import { createTeaserScenario } from "../src/data/strategyTeaser.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("landing preview uses actual engine, preserves provenance and covers zero, full reach and gap", () => {
  const preset = PILOT_STRATEGY_PRESETS[1]!;
  const scenario = createTeaserScenario(preset, 50);
  const result = calculateScenario(scenario);
  assert.equal(scenario.scenario_id, preset.id);
  assert.equal(scenario.reach, .5);
  assert.equal(preset.values.reach, .25);
  assert.ok(scenario.assumption_refs.length > 0);
  assert.equal(result.intended_reach, 6000);
  assert.equal(result.reached_participants, 3000);
  assert.equal(result.capacity_gap, 3000);
  assert.equal(result.program_resource_requirement, 1200000);
  assert.equal(calculateScenario(createTeaserScenario(preset, 0)).reached_participants, 0);
  assert.equal(calculateScenario(createTeaserScenario(preset, 100)).capacity_gap, 9000);
  assert.throws(() => createTeaserScenario(preset, 101), RangeError);
  assert.throws(() => createTeaserScenario(preset, -1), RangeError);
  assert.throws(() => createTeaserScenario(preset, NaN), RangeError);
});

test("teaser remains independent until explicitly applied; journey precedes lower-page content", () => {
  const teaser = read("../src/components/StrategyTeaserSandbox.tsx");
  const page = read("../src/pages/OverviewPage.tsx");
  const route = read("../src/components/LandingJourney.tsx");
  const routeCss = read("../src/components/LandingJourney.css");
  assert.match(teaser, /calculateScenario\(previewScenario\)/);
  assert.match(teaser, /const handleLoadIntoLab = \(\) => \{\s*setScenario\(previewScenario\);\s*setPilotInputDraft/);
  assert.match(teaser, /onClick=\{handleLoadIntoLab\}/);
  assert.ok(page.indexOf("<LandingJourney />") < page.indexOf("<StrategyTeaserSandbox />"));
  assert.match(route, /viewBox="0 0 1024 260"/);
  assert.match(route, /n: "Optional", to: "\/data-requests"/);
  assert.match(routeCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(route, /style=\{\{/);
});

test("decision inspector uses applied scenario and distinct AI state", () => {
  const pilot = read("../src/pages/PilotPage.tsx");
  const app = read("../src/App.tsx");
  assert.match(pilot, /atlas-decision-inspector/);
  assert.match(pilot, /scenarioResult\.capacity_gap/);
  assert.match(pilot, /Rule-based checks on the applied scenario, not AI predictions/);
  assert.match(pilot, /advisorAvailable &&/);
  assert.match(app, /const advisorAvailable = FutureAIExperiencePage !== null && showFutureConcept/);
});
