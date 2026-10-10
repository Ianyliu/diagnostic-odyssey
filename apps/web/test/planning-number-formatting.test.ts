import assert from "node:assert/strict";
import test from "node:test";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import {
  formatPlanningCurrency,
  formatPlanningNumber
} from "../src/data/planningNumberFormatting.ts";
import {
  createPilotInputDraft,
  evaluatePilotInputDraft,
  formatPilotInputHelper,
  formatPilotResultAnnouncement,
  pilotInputFields
} from "../src/data/pilotInputDraft.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { formatSensitivityInput } from "../src/data/sensitivityPresentation.ts";
import { formatRecognitionWindowDifference } from "../src/data/pilotDecisionPresentation.ts";
import { formatAppliedAssumption } from "../src/pages/briefAssumptions.ts";

test("ordinary planning numbers retain each caller's existing precision and grouping", () => {
  const formatters = [
    new Intl.NumberFormat("en-US"),
    new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}),
    new Intl.NumberFormat("en-US", {maximumFractionDigits: 10}),
    new Intl.NumberFormat("en-US", {maximumFractionDigits: 20}),
    new Intl.NumberFormat("en-US", {maximumFractionDigits: 8, useGrouping: false})
  ];
  for (const formatter of formatters) {
    for (const value of [0, -0, 0.001, 0.251234567, 1.1, 3000, 12000, 999999999999]) {
      assert.equal(formatPlanningNumber(value, formatter), formatter.format(value));
    }
  }
  for (const formatter of [
    new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}),
    new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2})
  ]) {
    for (const value of [0, -0, 0.001, 1.25, 300000, 1200000, 999999999999]) {
      assert.equal(formatPlanningCurrency(value, formatter), formatter.format(value));
    }
  }
});

test("huge finite planning labels are bounded and round trip without lost significant digits", () => {
  for (const magnitude of [1e12, 1.2345678901234568e20, 1e308, Number.MAX_VALUE]) {
    for (const value of [magnitude, -magnitude]) {
      const number = formatPlanningNumber(value);
      const currency = formatPlanningCurrency(value);
      assert.match(number, /e\+/);
      assert.ok(number.length <= 24, number);
      assert.ok(currency.length <= 25, currency);
      assert.equal(Number(number), value);
      assert.equal(Number(currency.replace("$", "")), value);
    }
  }
  assert.equal(formatPlanningCurrency(1e308), "$1e+308");
  assert.equal(formatPlanningCurrency(-1e308), "-$1e+308");
});

test("non-finite planning values fail instead of becoming plausible numeric labels", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => formatPlanningNumber(value), /non-finite planning value/);
    assert.throws(() => formatPlanningCurrency(value), /non-finite planning value/);
  }
});

test("valid huge finite scenario presentation leaves exact applied inputs and arithmetic intact", () => {
  const base = createPlanningScenarioDefaults();
  const draft = createPilotInputDraft(base);
  draft.fixed_cost = String(1.2345678901234567e308);
  draft.capacity = String(Number.MAX_VALUE);
  const evaluation = evaluatePilotInputDraft(draft, base);
  assert.ok(evaluation.candidate);
  const scenario = evaluation.candidate;
  const before = structuredClone(scenario);
  const result = calculateScenario(scenario);
  const resultBefore = structuredClone(result);

  assert.equal(createPilotInputDraft(scenario).fixed_cost, draft.fixed_cost);
  assert.equal(createPilotInputDraft(scenario).capacity, draft.capacity);
  assert.equal(formatPilotInputHelper("fixed_cost", draft.fixed_cost), "$1.2345678901234567e+308");
  assert.equal(formatPilotInputHelper("capacity", draft.capacity), "1.7976931348623157e+308 participants capacity");
  assert.match(formatPilotResultAnnouncement(result), /Program-resource requirement \$1\.2345678901234567e\+308\./);
  assert.equal(formatSensitivityInput("capacity", scenario.capacity), "1.7976931348623157e+308");
  assert.equal(formatRecognitionWindowDifference(1e308, 6), "1e+308");

  for (const field of pilotInputFields) {
    const label = formatAppliedAssumption(scenario, field);
    assert.ok(label.length < 60, label);
    if (field.key === "capacity" || field.key === "fixed_cost") {
      assert.equal(Number(label.replace("$", "")), scenario[field.key]);
    }
  }
  assert.deepEqual(scenario, before);
  assert.deepEqual(result, resultBefore);
  assert.equal(result.fixed_program_cost, scenario.fixed_cost);
  assert.equal(result.program_resource_requirement, scenario.fixed_cost);
  assert.equal(base.fixed_cost, 300000);
});
