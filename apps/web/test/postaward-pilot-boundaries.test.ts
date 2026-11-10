import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { formatPlanningNumber } from "../src/data/planningNumberFormatting.ts";
import {
  createPilotInputDraft,
  evaluatePilotInputDraft
} from "../src/data/pilotInputDraft.ts";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const pilotPage = source("../src/pages/PilotPage.tsx");
const visuals = source("../src/components/PilotDecisionVisuals.tsx");
const briefPage = source("../src/pages/BriefPage.tsx");

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});

const base: Scenario = {
  scenario_id: "postaward-pilot-boundaries",
  eligible_population: 9000,
  reach: 0.4,
  capacity: 2500,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 250000,
  per_participant_cost: 450,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: [],
  artifact_version: "test"
};

const extreme: Scenario = {
  ...base,
  eligible_population: 1e12,
  reach: 1,
  capacity: 2e11,
  fixed_cost: 1e9,
  per_participant_cost: 2.5e6
};

const scenarioCases: Array<[string, Scenario]> = [
  ["normal", base],
  ["zero-intent", {...base, reach: 0}],
  ["zero-eligible", {...base, eligible_population: 0}],
  ["overcapacity", {...base, capacity: 5000}],
  ["zero-capacity", {...base, capacity: 0}],
  ["zero-cost", {...base, fixed_cost: 0, per_participant_cost: 0}],
  ["extreme", extreme]
];

test("canonical scenario arithmetic is unchanged across normal, zero, overcapacity, and extreme scenarios", () => {
  for (const [name, scenario] of scenarioCases) {
    const result = calculateScenario(scenario);
    const intended = Math.max(0, Math.round(scenario.eligible_population * scenario.reach));
    const capacity = Math.max(0, Math.round(scenario.capacity));
    assert.equal(result.intended_reach, intended, name);
    assert.equal(result.reached_participants, Math.min(intended, capacity), name);
    assert.equal(result.capacity_gap, Math.max(0, intended - capacity), name);
    assert.equal(result.variable_program_cost, scenario.per_participant_cost * result.reached_participants, name);
    assert.equal(
      result.program_resource_requirement,
      scenario.fixed_cost + scenario.per_participant_cost * result.reached_participants,
      name
    );
    assert.ok(Number.isFinite(result.program_resource_requirement), name);
  }
});

test("computed result values differ by case and match the applied assumption arithmetic", () => {
  const normal = calculateScenario(base);
  assert.deepEqual(
    [normal.intended_reach, normal.reached_participants, normal.capacity_gap, normal.program_resource_requirement],
    [3600, 2500, 1100, 1375000]
  );

  const overcapacity = calculateScenario({...base, capacity: 5000});
  assert.equal(overcapacity.reached_participants, 3600);
  assert.equal(overcapacity.capacity_gap, 0);

  const zeroIntent = calculateScenario({...base, reach: 0});
  assert.deepEqual(
    [zeroIntent.intended_reach, zeroIntent.reached_participants, zeroIntent.capacity_gap, zeroIntent.program_resource_requirement],
    [0, 0, 0, 250000]
  );

  const extremeResult = calculateScenario(extreme);
  assert.equal(extremeResult.intended_reach, 1e12);
  assert.equal(extremeResult.reached_participants, 2e11);
  assert.equal(extremeResult.capacity_gap, 8e11);
  assert.equal(extremeResult.program_resource_requirement, 5e17 + 1e9);
});

test("overcapacity, zero-intent, and zero-capacity never yield a negative unmet count", () => {
  for (const [name, scenario] of scenarioCases) {
    const result = calculateScenario(scenario);
    assert.ok(result.reached_participants >= 0, name);
    assert.ok(result.capacity_gap >= 0, name);
    assert.ok(result.reached_participants <= result.intended_reach, name);
    assert.equal(result.reached_participants + result.capacity_gap, result.intended_reach, name);
  }
});

test("denominator quantities format without overflow artifacts for extreme inputs", () => {
  const extremeResult = calculateScenario(extreme);
  assert.equal(formatPlanningNumber(extremeResult.intended_reach, integer), (1e12).toExponential());
  assert.equal(formatPlanningNumber(extremeResult.reached_participants, integer), "200,000,000,000");
  assert.equal(formatPlanningNumber(extremeResult.capacity_gap, integer), "800,000,000,000");
  for (const value of [extremeResult.intended_reach, extremeResult.reached_participants, extremeResult.capacity_gap]) {
    assert.ok(Number.isFinite(value));
    assert.doesNotMatch(formatPlanningNumber(value, integer), /\d{16,}/);
  }
});

test("owned Pilot sources contain no hardcoded example denominator or expenditure figures", () => {
  const forbidden = ["3,000", "3000", "4,800", "4800", "1,800", "1800", "$1,200,000", "1,200,000", "1200000"];
  for (const label of forbidden) {
    assert.ok(!visuals.includes(label), `PilotDecisionVisuals must not hardcode ${label}`);
    assert.ok(!pilotPage.includes(label), `PilotPage must not hardcode ${label}`);
  }
});

test("PilotDecisionVisuals renders the resource denominator from canonical result fields", () => {
  assert.match(visuals, /function resourceDenominatorCopy\(result: ScenarioResult\): string/);
  assert.match(visuals, /<p className="resource-denominator">\{resourceDenominatorCopy\(result\)\}<\/p>/);
  assert.match(visuals, /result\.intended_reach <= 0/);
  assert.match(visuals, /formatPlanningNumber\(result\.reached_participants, integer\)/);
  assert.match(visuals, /formatPlanningNumber\(result\.intended_reach, integer\)/);
  assert.match(visuals, /formatPlanningNumber\(result\.capacity_gap, integer\)/);
  assert.match(visuals, /intended participant\$\{result\.capacity_gap === 1 \? "" : "s"\} unmet/);
  assert.match(visuals, /served within the applied capacity/);
  // The unmet count is the canonical engine field, never a client-side subtraction
  // that could go negative under overcapacity.
  assert.doesNotMatch(visuals, /result\.intended_reach\s*-\s*result\.reached_participants/);
  assert.doesNotMatch(visuals, /result\.reached_participants\s*-\s*result\.intended_reach/);
});

test("zero intended reach renders a coherent no-demand denominator sentence", () => {
  assert.match(
    visuals,
    /No intended participants under the current assumptions: the modeled expenditure serves no one and leaves no unmet intended reach\./
  );
  const zeroBranch = visuals.split("if (result.intended_reach <= 0)")[1]?.split("}")[0] ?? "";
  assert.ok(zeroBranch.length > 0, "zero-intent branch exists");
  assert.doesNotMatch(zeroBranch, /of \$\{/);
});

test("resource requirement is disclosed as modeled program expenditure, not savings, effect, ROI, or disease-attributable cost", () => {
  assert.match(visuals, /Modeled program expenditure for the applied pilot scope/);
  assert.match(visuals, /not an estimated saving, program effect, ROI, or disease-attributable cost/);
  assert.match(visuals, /distinct from national all-cause spending/);
  assert.match(visuals, /a planning input/);
  assert.doesNotMatch(visuals, /estimated (?:savings|benefit|effect) of/i);
});

test("Pilot and Brief render the same canonical program-resource requirement value", () => {
  assert.match(pilotPage, /\["Program-resource requirement", scenarioResult\.program_resource_requirement, true\]/);
  assert.match(
    pilotPage,
    /<dt>Program-resource requirement<\/dt><dd>\{formatPlanningCurrency\(scenarioResult\.program_resource_requirement\)\}/
  );
  assert.match(visuals, /const resourceTotal = result\.program_resource_requirement/);
  assert.match(briefPage, /formatPlanningCurrency\(brief\.scenario\.result\.program_resource_requirement\)/);
  const result = calculateScenario(base);
  assert.equal(result.program_resource_requirement, base.fixed_cost + base.per_participant_cost * result.reached_participants);
});

test("Pilot discloses that the full sensitivity series is not in the canonical Brief or AI handoff", () => {
  assert.match(pilotPage, /Full sensitivity series stays in this workspace/);
  assert.match(
    pilotPage,
    /is not part of the canonical Planning Brief, its JSON companion, or the AI handoff/
  );
  assert.match(pilotPage, /sensitivity status <code>not_in_planning_brief<\/code>/);
  assert.match(pilotPage, /existing data request pathway/);
  assert.match(pilotPage, /<Link to="\/data-requests">Data Requests<\/Link>/);
  assert.match(pilotPage, /<Link to="\/brief">Planning Brief<\/Link>/);
  // The disclosure sits beside the sensitivity interaction, after the explorer and
  // before the existing savings/ROI guardrail.
  const explorerEnd = pilotPage.indexOf("dataRequestStatus={sensitivityDataRequestStatus}");
  const disclosure = pilotPage.indexOf("Full sensitivity series stays in this workspace");
  const guardrail = pilotPage.indexOf("Not savings or ROI.");
  assert.ok(explorerEnd >= 0 && disclosure > explorerEnd && guardrail > disclosure);
  // No claim that the full series exists in the JSON companion.
  assert.doesNotMatch(pilotPage, /series (?:is|are) (?:part of|included in|available in|exported in)[\s\S]{0,80}JSON companion/i);
  assert.doesNotMatch(pilotPage, /JSON companion[^\n]*sensitivity series/i);
});

test("invalid drafts remain rejected before any result is applied", () => {
  for (const field of ["eligible_population", "capacity", "per_participant_cost", "fixed_cost"] as const) {
    const draft = createPilotInputDraft(base);
    draft[field] = "-1";
    assert.equal(evaluatePilotInputDraft(draft, base).candidate, null, field);
  }
  const incomplete = createPilotInputDraft(base);
  incomplete.reach = "1.";
  assert.equal(evaluatePilotInputDraft(incomplete, base).candidate, null);
  const overReach = createPilotInputDraft(base);
  overReach.reach = "101";
  assert.equal(evaluatePilotInputDraft(overReach, base).candidate, null);
});

test("existing Pilot behavior pins remain intact after the boundary additions", () => {
  assert.match(pilotPage, /invalidDraft \? <section id="sensitivity"/);
  assert.match(pilotPage, /Draft not applied/);
  assert.match(pilotPage, /last valid planning assumptions/);
  assert.match(pilotPage, /Sensitivity analysis paused/);
  assert.match(pilotPage, /disabled>Review planning brief<\/button>/);
  assert.match(pilotPage, /useRef\(getPilotResultSignature\(scenarioResult\)\)/);
  assert.match(pilotPage, /evaluatePilotInputDraft\(nextDraft, scenario\)/);
  assert.match(pilotPage, /<SensitivityPreview scenario=\{scenario\} paused=\{invalidDraft\}/);
  assert.match(pilotPage, /Not savings or ROI\./);
  assert.match(visuals, /capacityCoverage\.headline/);
  assert.match(visuals, /capacityCoverage\.ariaLabel/);
  assert.match(visuals, /capacityCoverage\.coveragePercent \?\? 0/);
  assert.match(visuals, /capacityCoverage\.noDemandCopy/);
  assert.match(visuals, /formatRecognitionWindowDifference/);
  assert.doesNotMatch(visuals, /coverage\.toFixed\(0\)/);
  assert.doesNotMatch(visuals, /scenario\.baseline_window_months - scenario\.alternative_window_months/);
});
