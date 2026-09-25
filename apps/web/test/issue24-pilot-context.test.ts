import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  assertValidLocalContextArtifact,
  type ArtifactBundle,
  type LocalContextArtifact
} from "@diagnostic-odyssey/contracts";
import { mergeBriefLocalContext } from "../src/data/briefLocalContext.ts";
import {
  createLocalContextSelectionForArtifact,
  resolveSelectedLocalContext,
  updateLocalContextSelection
} from "../src/data/localContextSelection.ts";
import {
  clearPilotLocalContextSelection,
  createPilotLocalContextSelectionForArtifact,
  resolvePilotLocalContext,
  selectPilotLocalContext
} from "../src/data/pilotLocalContextSelection.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";

const reviewedBundlePath = fileURLToPath(new URL("../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/bundle.json", import.meta.url));
const localContextPath = fileURLToPath(new URL("../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json", import.meta.url));

const rawBundle: unknown = JSON.parse(readFileSync(reviewedBundlePath, "utf8"));
assertValidArtifactBundle(rawBundle);
const bundle: ArtifactBundle = rawBundle;

const rawLocal: unknown = JSON.parse(readFileSync(localContextPath, "utf8"));
assertValidLocalContextArtifact(rawLocal);
const localContext: LocalContextArtifact = rawLocal;

const eligible = localContext.indicators.filter(record => record.release_status === "reviewed_released" && (record.state === "loaded" || record.state === "partial"));
assert.ok(eligible.length >= 2);
const recordA = eligible[0]!;
const recordB = eligible[1]!;

test("Brief and Pilot local-context selections remain independent", () => {
  let briefSelection = createLocalContextSelectionForArtifact(localContext);
  briefSelection = updateLocalContextSelection(briefSelection, localContext, recordA.indicator_id, true);
  let pilotSelection = createPilotLocalContextSelectionForArtifact(localContext);
  pilotSelection = selectPilotLocalContext(pilotSelection, localContext, recordB.indicator_id);
  assert.deepEqual(resolveSelectedLocalContext(briefSelection, "loaded", localContext).map(record => record.indicator_id), [recordA.indicator_id]);
  assert.equal(resolvePilotLocalContext(pilotSelection, "loaded", localContext)?.indicator_id, recordB.indicator_id);
});

test("Pilot selection replaces, clears, and fails closed across artifact versions", () => {
  let selection = createPilotLocalContextSelectionForArtifact(localContext);
  selection = selectPilotLocalContext(selection, localContext, recordA.indicator_id);
  assert.equal(resolvePilotLocalContext(selection, "loaded", localContext)?.indicator_id, recordA.indicator_id);
  selection = selectPilotLocalContext(selection, localContext, recordB.indicator_id);
  assert.equal(selection.indicatorId, recordB.indicator_id);
  assert.equal(resolvePilotLocalContext(selection, "loaded", localContext)?.indicator_id, recordB.indicator_id);
  const rotated = structuredClone(localContext);
  rotated.manifest.artifact_version += "-rotated";
  assert.equal(resolvePilotLocalContext(selection, "loaded", rotated), null);
  assert.equal(resolvePilotLocalContext(selection, "error", null), null);
  selection = clearPilotLocalContextSelection(localContext);
  assert.equal(selection.indicatorId, null);
  assert.equal(resolvePilotLocalContext(selection, "loaded", localContext), null);
});

test("Pilot local-context operations cannot mutate Scenario fields", () => {
  const scenario = createPlanningScenarioDefaults();
  const snapshot = structuredClone(scenario);
  let selection = createPilotLocalContextSelectionForArtifact(localContext);
  selection = selectPilotLocalContext(selection, localContext, recordA.indicator_id);
  selection = selectPilotLocalContext(selection, localContext, recordB.indicator_id);
  selection = clearPilotLocalContextSelection(localContext);
  assert.equal(selection.indicatorId, null);
  assert.deepEqual(scenario, snapshot);
});

test("Brief union adds Pilot-used context and deduplicates by indicator_id", () => {
  assert.deepEqual(mergeBriefLocalContext([recordA], recordB).map(record => record.indicator_id), [recordA.indicator_id, recordB.indicator_id]);
  assert.deepEqual(mergeBriefLocalContext([recordA], recordA).map(record => record.indicator_id), [recordA.indicator_id]);
});

test("six-step decision trace source preserves current descriptive boundaries", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/data/decisionTrace.ts", import.meta.url)),
    "utf8"
  );
  assert.equal(bundle.burden_domains.flatMap(domain => domain.measures).length, 21);
  for (const label of [
    "Released observed burden",
    "Explicitly selected reviewed local constraint/context",
    "Target pathway step",
    "Planning mechanism",
    "Measurement / data request needed",
    "Supported claim boundary"
  ]) {
    assert.ok(source.includes(label));
  }
  assert.match(source, /reviewed estimates · national descriptive evidence/);
  assert.match(source, /No explicit local constraint selected/);
  assert.match(source, /Reviewed local context is loading/);
  assert.match(source, /Reviewed local context is unavailable/);
  assert.match(source, /formatPathwayStepLabel/);
  assert.match(source, /formatMechanismLabel/);
  assert.match(source, /No current operational data request attached/);
  assert.match(source, /No reviewed intervention-effect parameter is available/);
  assert.match(source, /none is admissible for this scenario's pathway step and mechanism/);
  assert.match(source, /causal benefit, savings, ROI, and preventable-cost claims remain unavailable/);
  assert.match(source, /canDriveScenarioParameter/);
});

test("DecisionTrace and page sources preserve independent UI semantics", () => {
  const readSource = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const traceComponent = readSource("../src/components/DecisionTrace.tsx");
  const localPage = readSource("../src/pages/LocalContextPage.tsx");
  const pilotPage = readSource("../src/pages/PilotPage.tsx");
  const briefPage = readSource("../src/pages/BriefPage.tsx");
  const context = readSource("../src/data/ArtifactContext.tsx");
  assert.match(traceComponent, /not a proven causal chain/);
  assert.match(traceComponent, /<ol>/);
  assert.match(localPage, /Include in Planning Brief/);
  assert.match(localPage, /Use in Pilot planning/);
  assert.match(localPage, /Used in Pilot planning/);
  assert.match(localPage, /Remove from Pilot/);
  assert.match(localPage, /active Pilot-used context will also appear in the Planning Brief/);
  assert.match(pilotPage, /does not alter reach, capacity, timing, cost, pathway, or mechanism parameters/);
  assert.match(pilotPage, /No local implementation context is currently attached/);
  assert.match(briefPage, /mergeBriefLocalContext/);
  assert.match(briefPage, /Used in Pilot planning/);
  assert.match(briefPage, /currentDataRequestCount={selectedDataRequests.length}/);
  assert.match(context, /pilotLocalContextId: string \| null/);
  assert.match(context, /selectedLocalContextIds: string\[\]/);
  assert.doesNotMatch(context, /localStorage|sessionStorage/);
});
