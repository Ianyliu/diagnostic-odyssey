import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { pilotInputFields } from "../src/data/pilotInputDraft.ts";
import { formatAppliedAssumption } from "../src/pages/briefAssumptions.ts";
import { createBriefPrintDisclosureState } from "../src/pages/briefPrint.ts";

test("all eight applied Brief inputs retain precise assumption values", () => {
  const scenario: Scenario = {
    scenario_id: "print-check",
    eligible_population: 1000,
    reach: 0.2540000000000001,
    capacity: 250,
    baseline_window_months: 12,
    alternative_window_months: 6,
    horizon_months: 12,
    fixed_cost: 0.001,
    per_participant_cost: 25,
    target_pathway_step: "recognition-to-referral",
    mechanism: "navigation-support",
    assumption_refs: [],
    artifact_version: "test"
  };
  assert.equal(pilotInputFields.length, 8);
  const formatted = new Map(pilotInputFields.map(field =>
    [field.key, formatAppliedAssumption(scenario, field)]
  ));
  assert.match(formatted.get("reach") ?? "", /0\.2540000000000001/);
  assert.equal(formatted.get("fixed_cost"), "$0.001");
  assert.equal(formatted.get("baseline_window_months"), "12 months");
});

test("printing opens closed disclosures and restores each screen choice after cancellation", () => {
  const disclosures = [{open: false}, {open: true}, {open: false}];
  const state = createBriefPrintDisclosureState(() => disclosures);

  state.prepare();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [true, true, true]);
  state.prepare();
  state.restore();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true, false]);

  disclosures[2]!.open = true;
  state.prepare();
  state.restore();
  assert.deepEqual(disclosures.map(disclosure => disclosure.open), [false, true, true]);
});

test("Planning Brief wires print events for browser and application print", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(source, /addEventListener\("beforeprint", state\.prepare\)/);
  assert.match(source, /addEventListener\("afterprint", state\.restore\)/);
  assert.match(source, /printDisclosureState\.current\?\.prepare\(\)/);
  assert.match(source, /onClick=\{printBrief\}/);
  assert.match(source, /serializeBriefJson\(brief\)/);
});

test("applied Brief inputs and scenario outputs occupy separate document sections", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/pages/BriefPage.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(source, /id="brief-pilot-assumptions"/);
  assert.match(source, /id="brief-scenario-outputs"/);
  assert.match(source, /pilotInputFields\.map\(field =>/);
  assert.match(source, /formatAppliedAssumption\(brief\.scenario!\.input, field\)/);
  assert.ok(source.indexOf("brief-applied-assumptions") < source.indexOf("brief-output-list"));
});
