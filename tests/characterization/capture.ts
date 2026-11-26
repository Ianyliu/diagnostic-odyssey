/**
 * Deterministic behavioral characterization of the scientific and contract layers.
 *
 * Purpose: pin the *observable behavior* of validators, the scenario engine, evidence
 * gating, Brief generation/serialization, acquisition hints, planning guidance, AI
 * handoff payloads and presentation logic so that behavior-preserving refactors can be
 * proven equivalent by exact comparison against a golden snapshot generated from the
 * pre-refactor code.
 *
 * Rules:
 *  - Everything here is deterministic: no clocks, randomness or network.
 *  - Outcomes (values or thrown errors) are recorded; nothing is mocked.
 *  - Small outcomes are stored in full for readable diffs; large ones as SHA-256 digests.
 *  - No numeric tolerances: comparison is exact over canonical JSON.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as contracts from "@diagnostic-odyssey/contracts";
import * as scenarioEngine from "@diagnostic-odyssey/scenario-engine";
import * as evidenceCore from "@diagnostic-odyssey/evidence-core";
import * as conditionAdapters from "@diagnostic-odyssey/condition-adapters";
import * as briefCore from "@diagnostic-odyssey/brief-core";
import * as acquisitionHints from "@diagnostic-odyssey/acquisition-hints";
import * as planningGuidance from "@diagnostic-odyssey/planning-guidance";
import * as narrativeReferences from "@diagnostic-odyssey/narrative-references";
import type { ArtifactBundle, EvidenceRecord, Estimate, LocalContextArtifact, Scenario } from "@diagnostic-odyssey/contracts";
import { createPlanningScenarioDefaults, PILOT_STRATEGY_PRESETS } from "../../apps/web/src/data/planningScenarioDefaults.ts";
import { loadReviewedMepsArtifact } from "../../apps/web/src/data/reviewedArtifact.ts";
import { loadReviewedWvLocalContextArtifact } from "../../apps/web/src/data/reviewedLocalContext.ts";
import { buildScenarioComparisonRows, presetMatchesScenario } from "../../apps/web/src/data/scenarioComparison.ts";
import { buildCapacityThresholdCurveResult } from "../../apps/web/src/data/capacityThresholdCurve.ts";
import { evaluateScenarioSensitivity } from "../../apps/web/src/data/decisionVisuals.ts";
import { createPilotInputDraft, evaluatePilotInputDraft, formatPilotInputHelper, formatPilotResultAnnouncement, getPilotResultSignature, pilotInputFields } from "../../apps/web/src/data/pilotInputDraft.ts";
import { getCapacityCoveragePresentation, formatRecognitionWindowDifference } from "../../apps/web/src/data/pilotDecisionPresentation.ts";
import { formatSensitivityInput, getSensitivityBarWidth } from "../../apps/web/src/data/sensitivityPresentation.ts";
import { formatPlanningCurrency, formatPlanningNumber, formatPlanningPercent } from "../../apps/web/src/data/planningNumberFormatting.ts";
import { formatMetricTick, formatMetricValue } from "../../apps/web/src/data/metricFormatting.ts";
import { formatEstimateInterval, formatEstimateValue, formatNativeValue } from "../../apps/web/src/data/formatEstimateValue.ts";
import { getPathwayBoundaryPresentation } from "../../apps/web/src/data/pathwayBoundary.ts";
import { getEvidenceParameterReadiness, getNationalBurdenReadiness } from "../../apps/web/src/data/workspaceReadiness.ts";
import { buildPlanningInsights, type PlanningInsightsSources } from "../../apps/web/src/data/planningInsights.ts";
import { createAiHandoffText, createConciseAiHandoffText } from "../../apps/web/src/data/aiHandoff.ts";
import { AI_GOALS } from "../../apps/web/src/data/aiHandoffTemplates.ts";
import { getBurdenScaleDomain, getLocalContextScaleDomain, metricGeometry } from "../../apps/web/src/data/metricGeometry.ts";
import { canonicalJson as canonicalJsonText, sha256 as sha256Text } from "../../packages/acquisition-hints/src/sha256.ts";
import { makePlanningGuidanceInput } from "./fixtures/planning-guidance-input.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const reviewedRoot = `${here}../../artifacts/reviewed/`;
const readReviewed = (path: string): unknown => JSON.parse(readFileSync(reviewedRoot + path, "utf8"));

// ---------------------------------------------------------------------------
// Canonical serialization and recording
// ---------------------------------------------------------------------------

function normalize(value: unknown): unknown {
  if (value === undefined) return { $undefined: true };
  if (typeof value === "number") {
    if (Number.isNaN(value)) return { $number: "NaN" };
    if (!Number.isFinite(value)) return { $number: value > 0 ? "Infinity" : "-Infinity" };
    if (Object.is(value, -0)) return { $number: "-0" };
    return value;
  }
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (typeof value === "function") return { $function: value.name };
  if (value instanceof Error) return { $error: { name: value.name, message: value.message } };
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Map) return { $map: [...value.entries()].map(([k, v]) => [normalize(k), normalize(v)]) };
  if (value instanceof Set) return { $set: [...value.values()].map(normalize) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = normalize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const FULL_LIMIT = 1500;

export type CaseRecord = unknown;
export type Characterization = { schema: 1; caseCount: number; cases: Record<string, CaseRecord> };

class Recorder {
  readonly cases: Record<string, CaseRecord> = {};
  /** Run `fn` and record its value or thrown error under `id`. */
  record(id: string, fn: () => unknown, mode: "auto" | "digest" = "auto"): void {
    if (id in this.cases) throw new Error(`duplicate characterization case: ${id}`);
    let outcome: unknown;
    try { outcome = { ok: fn() }; }
    catch (error) {
      const e = error as { name?: string; message?: string };
      outcome = { threw: { name: String(e?.name), message: String(e?.message) } };
    }
    const text = canonicalJson(outcome);
    this.cases[id] = mode === "digest" || text.length > FULL_LIMIT
      ? { sha256: sha(text).slice(0, 16), bytes: text.length }
      : JSON.parse(text);
  }
}

// ---------------------------------------------------------------------------
// Mutation sweeps over valid fixtures: delete / null / wrong type / boundary numbers.
// ---------------------------------------------------------------------------

type Path = (string | number)[];
const DELETE = Symbol("delete");
const MUTATIONS: [string, unknown][] = [
  ["delete", DELETE], ["null", null], ["empty-string", ""], ["text", "x"], ["negative", -1], ["zero", 0],
  ["fraction", 1.5], ["nan", Number.NaN], ["infinity", Number.POSITIVE_INFINITY], ["true", true],
  ["empty-array", []], ["empty-object", {}]
];

function leafPaths(value: unknown, maxDepth: number, prefix: Path = []): Path[] {
  if (prefix.length >= maxDepth || value === null || typeof value !== "object") return prefix.length ? [prefix] : [];
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v] as const) : Object.entries(value);
  if (entries.length === 0) return [prefix];
  return entries.flatMap(([key, child]) => leafPaths(child, maxDepth, [...prefix, key]));
}

function applyMutation(base: unknown, path: Path, replacement: unknown): unknown {
  const copy = structuredClone(base) as Record<string | number, unknown>;
  let cursor = copy;
  for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string | number, unknown>;
  const last = path[path.length - 1] as string | number;
  if (replacement === DELETE) {
    if (Array.isArray(cursor)) cursor.splice(Number(last), 1); else delete cursor[last];
  } else {
    cursor[last] = structuredClone(replacement);
  }
  return copy;
}

function sweep(rec: Recorder, id: string, base: unknown, run: (value: unknown) => unknown, maxDepth: number): void {
  rec.record(`${id}/base`, () => run(structuredClone(base)));
  for (const path of leafPaths(base, maxDepth)) {
    for (const [name, replacement] of MUTATIONS) {
      rec.record(`${id}/${path.join(".")}/${name}`, () => run(applyMutation(base, path, replacement)), "digest");
    }
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const GENERATED_AT = "2026-10-15T12:00:00.000Z";
const approvedEvidence: EvidenceRecord = {
  evidence_id: "synthetic-test-evidence", source: "Synthetic fixture, not a real source", locator: "test-only",
  population: "test population", condition_definition: "test condition", outcome: "test outcome",
  effect_or_parameter: null, uncertainty: null, system_boundary: "test boundary",
  pathway_step: "recognition-to-referral", target_mechanism: "navigation-support", geography: "test", payer: "test",
  year: 2026, limitations: ["Synthetic test fixture only."], reviewer_status: "approved",
  admissibility_status: "supported_with_bounds", allowed_use: "Test fixture."
};

function nationalMeasures(national: ArtifactBundle): Estimate[] {
  return national.burden_domains.flatMap(domain => domain.measures);
}

export function buildCharacterization(): Characterization {
  const rec = new Recorder();
  const national = structuredClone(loadReviewedMepsArtifact());
  const local = structuredClone(loadReviewedWvLocalContextArtifact()) as LocalContextArtifact;
  const defaults = createPlanningScenarioDefaults();
  const measures = nationalMeasures(national);

  // 1. Runtime public API surface of every workspace package --------------------------------
  const apis: Record<string, Record<string, unknown>> = {
    contracts, scenarioEngine, evidenceCore, conditionAdapters, briefCore, acquisitionHints, planningGuidance, narrativeReferences
  };
  for (const [name, module] of Object.entries(apis)) {
    rec.record(`api/runtime/${name}`, () => Object.fromEntries(Object.keys(module).sort().map(key => [key, typeof module[key]])));
  }
  rec.record("api/runtime/contracts/enums", () => ({
    evidenceTypes: contracts.evidenceTypes, releaseStatuses: contracts.releaseStatuses, displayStatuses: contracts.displayStatuses,
    admissibilityStatuses: contracts.admissibilityStatuses, dataStates: contracts.dataStates
  }));

  // 2. Contracts: real reviewed artifacts ---------------------------------------------------
  for (const version of ["meps-2024-long-covid-candidate-20260923T020607Z", "meps-2024-long-covid-candidate-20260926T011343Z"]) {
    rec.record(`contracts/real/bundle/${version}`, () => contracts.validateArtifactBundle(readReviewed(`${version}/bundle.json`)));
  }
  rec.record("contracts/real/local-context", () => ({
    issues: contracts.validateLocalContextArtifact(local),
    canLoad: contracts.canLoadReviewedLocalContextArtifact(local),
    count: local.indicators.length
  }));
  const linkedDir = "meps-2024-linked-condition-service-use-reviewed-20260929-v1/";
  const linkedPackage = {
    candidateFile: readReviewed(`${linkedDir}linked-condition-candidate-estimates.json`),
    reviewedDiagnostics: readReviewed(`${linkedDir}reviewed-diagnostics.json`),
    sourceMetadata: readReviewed(`${linkedDir}source-metadata.json`),
    runManifest: readReviewed(`${linkedDir}github-actions-run-manifest.json`),
    reviewManifest: readReviewed(`${linkedDir}review-manifest.json`),
    productPolicy: readReviewed(`${linkedDir}product-policy.json`)
  };
  rec.record("contracts/real/linked-condition/package", () => { contracts.assertValidReviewedLinkedConditionPackage(linkedPackage); return "valid"; });
  rec.record("contracts/real/linked-condition/diagnostics", () => contracts.validateReviewedLinkedConditionDiagnostics(linkedPackage.reviewedDiagnostics));
  rec.record("contracts/real/linked-condition/sources", () => contracts.validateReviewedLinkedConditionSources(linkedPackage.sourceMetadata));
  rec.record("contracts/real/linked-condition/policy", () => contracts.validateLinkedConditionProductPolicy(linkedPackage.productPolicy));
  rec.record("contracts/real/linked-condition/candidate-manifest", () => contracts.validateLinkedConditionCandidateManifest(linkedPackage.candidateFile));
  rec.record("contracts/real/linked-condition/snapshot", () => contracts.validateReviewedLinkedConditionCandidateSnapshot(linkedPackage.candidateFile));

  // 3. Contracts: mutation sweeps -----------------------------------------------------------
  const baseEstimate = measures[0]!;
  sweep(rec, "contracts/sweep/estimate", baseEstimate, v => contracts.validateEstimate(v), 2);
  sweep(rec, "contracts/sweep/scenario", defaults, v => contracts.validateScenario(v), 1);
  sweep(rec, "contracts/sweep/scenario-result", scenarioEngine.calculateScenario(defaults), v => contracts.validateScenarioResult(v), 1);
  sweep(rec, "contracts/sweep/local-record", local.indicators[0], v => contracts.validateLocalContextRecord(v), 2);
  const sensitivityRequest = acquisitionHints.createSensitivityDataRequest(defaults, "capacity");
  sweep(rec, "contracts/sweep/data-request", sensitivityRequest, v => contracts.validateDataRequest(v), 2);
  if (sensitivityRequest.acquisition_hint) {
    sweep(rec, "contracts/sweep/acquisition-hint", sensitivityRequest.acquisition_hint, v => contracts.validateAcquisitionHintReference(v), 2);
  }
  sweep(rec, "contracts/sweep/bundle", national, v => contracts.validateArtifactBundle(v), 2);
  sweep(rec, "contracts/sweep/local-artifact", local, v => contracts.validateLocalContextArtifact(v), 2);
  rec.record("contracts/sweep/non-objects", () => [undefined, null, 0, "x", [], true].map(v => ({
    estimate: contracts.validateEstimate(v), scenario: contracts.validateScenario(v), result: contracts.validateScenarioResult(v),
    request: contracts.validateDataRequest(v), bundle: contracts.validateArtifactBundle(v), local: contracts.validateLocalContextArtifact(v)
  })));

  // 4. Estimate status matrix: observed/modeled/hypothetical/unavailable distinctions ------------
  for (const evidenceType of contracts.evidenceTypes) {
    for (const releaseStatus of contracts.releaseStatuses) {
      for (const displayStatus of contracts.displayStatuses) {
        for (const shape of ["value+ci", "value-only", "null-value"] as const) {
          const candidate = {
            ...baseEstimate, evidence_type: evidenceType, release_status: releaseStatus, display_status: displayStatus,
            ...(shape === "value-only" ? { interval_low: null, interval_high: null, interval_type: null } : {}),
            ...(shape === "null-value" ? { value: null, interval_low: null, interval_high: null, interval_type: null } : {})
          } as Estimate;
          rec.record(`contracts/matrix/${evidenceType}/${releaseStatus}/${displayStatus}/${shape}`, () => ({
            issues: contracts.validateEstimate(candidate),
            exportable: contracts.canExportEstimate(candidate),
            distribution: contracts.canDisplayDistributionSummary(candidate)
          }));
        }
      }
    }
  }
  rec.record("contracts/real/estimate-taxonomy", () => measures.map(m => ({
    id: m.estimate_id, type: m.evidence_type, release: m.release_status, display: m.display_status,
    hasValue: m.value !== null, exportable: contracts.canExportEstimate(m), distribution: contracts.canDisplayDistributionSummary(m),
    unit: m.unit, interval: m.interval_type
  })));
  rec.record("contracts/real/local-taxonomy", () => local.indicators.map(r => ({
    id: r.indicator_id, release: r.release_status, state: r.state, value: r.value, unit: r.unit
  })));

  // 5. Scenario engine ---------------------------------------------------------------------
  const scenarioFields = ["eligible_population", "reach", "capacity", "baseline_window_months", "alternative_window_months", "horizon_months", "fixed_cost", "per_participant_cost"] as const;
  const boundaryValues = [0, 1, 0.5, 1e-9, 1.0000001, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE, 12.5, 1e15, 0.251, 6.125];
  rec.record("scenario/defaults", () => ({ defaults, result: scenarioEngine.calculateScenario(defaults) }));
  for (const preset of PILOT_STRATEGY_PRESETS) {
    rec.record(`scenario/preset/${preset.id}`, () => ({ preset, result: scenarioEngine.calculateScenario({ ...defaults, ...preset.values }), matchesDefaults: presetMatchesScenario(preset, defaults) }));
  }
  for (const field of scenarioFields) {
    for (const value of boundaryValues) {
      rec.record(`scenario/boundary/${field}/${String(value)}`, () => scenarioEngine.calculateScenario({ ...defaults, [field]: value }));
    }
  }
  for (const field of ["reach", "capacity", "alternative_window_months"] as const) {
    rec.record(`scenario/sensitivity/${field}`, () => scenarioEngine.oneWaySensitivity(defaults, field, [0, 0.1, 0.25, 0.5, 1, 100, 3000]));
    rec.record(`scenario/sensitivity-invalid/${field}`, () => scenarioEngine.oneWaySensitivity(defaults, field, [Number.NaN]));
    rec.record(`scenario/sensitivity-empty/${field}`, () => scenarioEngine.oneWaySensitivity(defaults, field, []));
  }
  const goodEffect = { pathway_step: defaults.target_pathway_step, target_mechanism: defaults.mechanism, effect_type: "synthetic", lower: 0.1, central: 0.2, upper: 0.3 };
  const baseResult = scenarioEngine.calculateScenario(defaults);
  rec.record("scenario/effect/matching", () => scenarioEngine.attachBoundedEffect(defaults, baseResult, goodEffect as never));
  rec.record("scenario/effect/wrong-step", () => scenarioEngine.attachBoundedEffect(defaults, baseResult, { ...goodEffect, pathway_step: "other" } as never));
  rec.record("scenario/effect/wrong-mechanism", () => scenarioEngine.attachBoundedEffect(defaults, baseResult, { ...goodEffect, target_mechanism: "other" } as never));
  rec.record("scenario/helpers", () => [0, 1, 2.5, 1e6].map(n => ({
    n, window: scenarioEngine.personMonthExposure(n, 12, 6), reach: scenarioEngine.intendedReach({ ...defaults, eligible_population: n }),
    gap: scenarioEngine.capacityGap({ ...defaults, eligible_population: n, capacity: 1 })
  })));

  // 6. Evidence gating ----------------------------------------------------------------------
  for (const reviewer of ["draft", "needs_review", "approved", "rejected"] as const) {
    for (const admissibility of contracts.admissibilityStatuses) {
      for (const pathway of [defaults.target_pathway_step, "other", ""]) {
        for (const mechanism of [defaults.mechanism, "other", null]) {
          const evidence = { ...approvedEvidence, reviewer_status: reviewer, admissibility_status: admissibility, pathway_step: pathway, target_mechanism: mechanism } as EvidenceRecord;
          rec.record(`evidence/${reviewer}/${admissibility}/${pathway || "empty"}/${mechanism ?? "null"}`, () => ({
            decision: evidenceCore.canDriveScenarioParameter(evidence, defaults),
            label: evidenceCore.evidenceClaimLabel(evidence),
            readiness: getEvidenceParameterReadiness([evidence], defaults)
          }));
        }
      }
    }
  }
  rec.record("evidence/readiness/none", () => ({ none: getEvidenceParameterReadiness([], defaults), unchecked: getEvidenceParameterReadiness([approvedEvidence], null) }));
  rec.record("evidence/national-readiness", () => [0, 1, 21].map(n => getNationalBurdenReadiness(n)));

  // 7. Condition adapters ----------------------------------------------------------------------
  rec.record("adapters/all", () => conditionAdapters.conditionAdapters);
  for (const id of ["long-covid", "mecfs", "unknown", "", "__proto__", "constructor", "toString"]) {
    rec.record(`adapters/get/${id || "empty"}`, () => conditionAdapters.getConditionAdapter(id));
  }

  // 8. Planning Brief generation and JSON exports ------------------------------------------------
  const baseContext = { ...national.context };
  const briefInput = (overrides: Record<string, unknown> = {}) => ({
    context: { ...baseContext, local_context_id: null }, estimates: measures, localContext: [] as never[],
    scenario: { input: defaults, result: scenarioEngine.calculateScenario(defaults) }, evidence: national.evidence,
    dataRequests: [] as never[], generatedAt: GENERATED_AT, ...overrides
  });
  const serialize = (input: ReturnType<typeof briefInput>) => {
    const brief = briefCore.buildPlanningBrief(input as never);
    const json = briefCore.serializeBriefJson(brief);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return { jsonSha256: sha(json), jsonBytes: json.length, summary: { keys: Object.keys(parsed), findings: (parsed.burden_findings as unknown[]).length, warnings: parsed.warnings, requests: (parsed.data_requests as unknown[]).length } };
  };
  const briefConfigs: Record<string, ReturnType<typeof briefInput>> = {
    "national-only": briefInput({ scenario: null }),
    "with-scenario": briefInput(),
    "with-local-1": briefInput({ context: { ...baseContext, local_context_id: local.manifest.artifact_version }, localContext: [local.indicators[0]] }),
    "with-local-all": briefInput({ context: { ...baseContext, local_context_id: local.manifest.artifact_version }, localContext: local.indicators }),
    "with-evidence": briefInput({ evidence: [...national.evidence, approvedEvidence] }),
    "with-requests": briefInput({ dataRequests: (["capacity", "reach", "alternative_window_months"] as const).map(f => acquisitionHints.createSensitivityDataRequest(defaults, f)) }),
    "stale-request": briefInput({ dataRequests: [acquisitionHints.createSensitivityDataRequest({ ...defaults, capacity: 1 }, "capacity")] }),
    "unreleased-excluded": briefInput({ estimates: [{ ...baseEstimate, release_status: "suppressed", value: null }, { ...baseEstimate, estimate_id: "illustrative-1", display_status: "illustrative" }, ...measures] }),
    "no-estimates": briefInput({ estimates: [] })
  };
  for (const [name, input] of Object.entries(briefConfigs)) {
    rec.record(`brief/${name}`, () => serialize(input));
  }
  rec.record("brief/invalid-scenario", () => serialize(briefInput({ scenario: { input: { ...defaults, reach: 25 }, result: baseResult } })));
  rec.record("brief/mismatched-result", () => serialize(briefInput({ scenario: { input: defaults, result: { ...baseResult, reached_participants: -1 } } })));

  // 9. Acquisition hints / data requests ------------------------------------------------------------
  for (const field of ["capacity", "reach", "alternative_window_months"] as const) {
    const request = acquisitionHints.createSensitivityDataRequest(defaults, field);
    rec.record(`requests/${field}`, () => ({
      request, id: acquisitionHints.sensitivityDataRequestId(field),
      fieldFromId: acquisitionHints.sensitivityFieldFromDataRequestId(request.request_id),
      status: acquisitionHints.getSensitivityDataRequestStatus(defaults, field, [request]),
      statusStale: acquisitionHints.getSensitivityDataRequestStatus({ ...defaults, capacity: 7, reach: 0.9, alternative_window_months: 1 }, field, [request]),
      statusAbsent: acquisitionHints.getSensitivityDataRequestStatus(defaults, field, []),
      current: acquisitionHints.isDataRequestCurrentForScenario(request, defaults),
      currentChanged: acquisitionHints.isDataRequestCurrentForScenario(request, { ...defaults, capacity: 7, reach: 0.9, alternative_window_months: 1 }),
      currentNull: acquisitionHints.isDataRequestCurrentForScenario(request, null),
      sanitized: acquisitionHints.sanitizeBaseDataRequest(request),
      fingerprint: acquisitionHints.requestFingerprint(request, baseContext, defaults)
    }));
  }
  rec.record("requests/sanitize-invalid", () => [null, 1, "x", [], {}].map(v => { try { return acquisitionHints.sanitizeBaseDataRequest(v); } catch (e) { return (e as Error).message; } }));
  rec.record("requests/sha-and-canonical", () => ({ sha: sha256Text("abc"), canonical: canonicalJsonText({ b: 1, a: [2, { d: 1, c: null }] }) }));

  // 10. Planning guidance (offline, synthetic) --------------------------------------------------------
  const authority = { narrative: null, hints: null };
  const guidanceInput = makePlanningGuidanceInput();
  rec.record("guidance/egress", () => planningGuidance.projectEgress(guidanceInput, authority));
  rec.record("guidance/fingerprint", () => planningGuidance.fingerprint(guidanceInput, authority));
  rec.record("guidance/snapshot", () => planningGuidance.snapshotContent(guidanceInput, authority));
  const egress = planningGuidance.projectEgress(guidanceInput, authority);
  const candidate = { schema_version: "pg.v1", snapshot_fingerprint: egress.snapshot_fingerprint, finding_ids: ["finding_synthetic_1"], options: [], requests: [{ template_id: "template_synthetic_1", gap_id: "gap_synthetic_1", hint_id: null }] };
  rec.record("guidance/bound", () => planningGuidance.bindCandidate(guidanceInput, authority, candidate, "synth_1", "2026-10-25T15:00:00Z", egress.snapshot_fingerprint));
  rec.record("guidance/bound-stale", () => planningGuidance.bindCandidate(guidanceInput, authority, candidate, "synth_1", "2026-10-25T15:00:00Z", "pg1:" + "0".repeat(64)));
  rec.record("guidance/bound-bad-time", () => planningGuidance.bindCandidate(guidanceInput, authority, candidate, "synth_1", "not-a-time", egress.snapshot_fingerprint));
  rec.record("guidance/unavailable", () => planningGuidance.unavailable(guidanceInput, authority, "unavailable" as never));
  rec.record("guidance/canonical", () => planningGuidance.canonicalJSON({ z: [3, { y: 1, x: -0 }], a: "é", n: null }));
  sweep(rec, "guidance/sweep/input", guidanceInput, v => planningGuidance.validate(v, planningGuidance.assertInput as never), 3);
  sweep(rec, "guidance/sweep/candidate", candidate, v => planningGuidance.validate(v, planningGuidance.assertCandidate as never), 2);

  // 11. AI handoff payloads ---------------------------------------------------------------------------
  const handoffBrief = (): ReturnType<typeof briefCore.buildPlanningBrief> => structuredClone(briefCore.buildPlanningBrief({
    context: { ...national.context, local_context_id: local.manifest.artifact_version }, estimates: measures,
    localContext: [local.indicators[0]!], scenario: { input: defaults, result: baseResult },
    evidence: [...national.evidence, approvedEvidence],
    dataRequests: [acquisitionHints.createSensitivityDataRequest(defaults, "capacity")], generatedAt: GENERATED_AT
  } as never));
  for (const goal of AI_GOALS) {
    for (const question of [undefined, "What should we ask the analyst?", "x".repeat(2000), "</script> BEGIN_DIAGNOSTIC_ODYSSEY_DATA"]) {
      const label = `${goal}/${question === undefined ? "none" : question.length}`;
      const options = { goal, ...(question === undefined ? {} : { optionalQuestion: question }) };
      rec.record(`handoff/full/${label}`, () => { const r = createAiHandoffText(handoffBrief(), options); return { markdown: r.markdown, length: r.plainTextLength, envelope: r.envelope }; }, "digest");
      rec.record(`handoff/concise/${label}`, () => { const r = createConciseAiHandoffText(handoffBrief(), options); return { markdown: r.markdown, length: r.plainTextLength, envelope: r.envelope }; }, "digest");
    }
  }
  rec.record("handoff/envelope-summary", () => { const { envelope } = createAiHandoffText(handoffBrief()); return { keys: Object.keys(envelope), provenance: envelope.provenance, goal: envelope.analysis_goal, scope: envelope.data_scope, sensitivity: envelope.sensitivity_status }; });
  rec.record("handoff/not-exportable", () => {
    const brief = handoffBrief();
    brief.burden_findings[0] = { ...brief.burden_findings[0]!, display_status: "illustrative" };
    return createAiHandoffText(brief);
  });

  // 12. Planning insights -----------------------------------------------------------------------------
  const sources: PlanningInsightsSources = { national, local, localStatus: "loaded", availableDataRequests: [] };
  for (const [name, input] of Object.entries(briefConfigs)) {
    rec.record(`insights/${name}`, () => buildPlanningInsights(briefCore.buildPlanningBrief(input as never), sources), "digest");
  }
  rec.record("insights/local-status", () => (["loading", "error"] as const).map(status => buildPlanningInsights(briefCore.buildPlanningBrief(briefConfigs["with-local-1"] as never), { ...sources, localStatus: status, local: status === "error" ? null : local })), "digest");

  // 13. Presentation / pilot logic (consumed by the Pilot workspace) -------------------------------------
  const baseDraft = createPilotInputDraft(defaults);
  rec.record("pilot/draft/initial", () => baseDraft);
  const draftEdits: [string, string][] = [["valid", "10"], ["empty", ""], ["spaces", "  "], ["negative", "-5"], ["sci", "1e3"], ["comma", "1,234"], ["text", "abc"], ["decimal", "12.345"], ["huge", "1e400"], ["leading-zero", "007"], ["percent", "25%"], ["dot", "."], ["plus", "+3"]];
  for (const field of pilotInputFields) {
    for (const [label, text] of draftEdits) {
      rec.record(`pilot/draft/${field.key}/${label}`, () => ({
        evaluation: evaluatePilotInputDraft({ ...baseDraft, [field.key]: text }, defaults),
        helper: formatPilotInputHelper(field.key, text)
      }));
    }
  }
  rec.record("pilot/draft/reach-over-100", () => evaluatePilotInputDraft({ ...baseDraft, reach: "101" }, defaults));
  rec.record("pilot/draft/window-order", () => evaluatePilotInputDraft({ ...baseDraft, alternative_window_months: "99" }, defaults));
  rec.record("pilot/draft/overflow", () => evaluatePilotInputDraft({ ...baseDraft, fixed_cost: "1.7e308", per_participant_cost: "1.7e308" }, defaults));
  rec.record("pilot/result/announcement", () => ({ signature: getPilotResultSignature(baseResult), announcement: formatPilotResultAnnouncement(baseResult) }));
  rec.record("pilot/result/invalid", () => formatPilotResultAnnouncement({ ...baseResult, reached_participants: Number.NaN }));
  const scenarioVariants: Record<string, Scenario> = {
    defaults, "over-capacity": { ...defaults, capacity: 1 }, "zero-reach": { ...defaults, reach: 0 }, "full-reach": { ...defaults, reach: 1 },
    "zero-capacity": { ...defaults, capacity: 0 }, "tiny": { ...defaults, eligible_population: 1, capacity: 1 },
    "overflow": { ...defaults, fixed_cost: Number.MAX_VALUE, per_participant_cost: Number.MAX_VALUE }, "invalid": { ...defaults, reach: 25 }
  };
  for (const [name, scenario] of Object.entries(scenarioVariants)) {
    rec.record(`pilot/view/${name}`, () => ({
      comparison: buildScenarioComparisonRows(scenario), curve: buildCapacityThresholdCurveResult(scenario),
      sensitivity: (["capacity", "reach", "alternative_window_months"] as const).map(f => evaluateScenarioSensitivity(scenario, f)),
      boundary: getPathwayBoundaryPresentation(scenario)
    }), "digest");
    rec.record(`pilot/coverage/${name}`, () => getCapacityCoveragePresentation(scenarioEngine.calculateScenario(scenario)));
  }
  rec.record("pilot/formatting", () => ({
    window: [[12, 6], [6, 12], [0, 0], [12.5, 0.25]].map(([a, b]) => formatRecognitionWindowDifference(a!, b!)),
    numbers: [0, 1, 1234567.891, -3, 1e21, 1e-7].map(n => [formatPlanningNumber(n), formatPlanningCurrency(n), formatPlanningPercent(n)]),
    metrics: [[0, "proportion"], [0.123, "proportion"], [1234, "USD/year"], [56.789, "USD/person/year"], [1e6, "people"], [3.14159, "hours"], [5, "percent"]].map(([v, u]) => [formatMetricValue(v as number, u as string), formatMetricTick(v as number, u as string, true), formatMetricTick(v as number, u as string, false), formatNativeValue(v as number, u as string)]),
    sensitivityInput: ["capacity", "reach", "alternative_window_months"].flatMap(field => [0, 0.5, 1, 2, -1, Number.NaN].map(v => { try { return formatSensitivityInput(field as never, v); } catch (e) { return (e as Error).message; } })),
    barWidth: [[0, 0], [5, 10], [20, 10], [-1, 0]].map(([a, b]) => getSensitivityBarWidth(a!, b!))
  }));
  rec.record("presentation/estimates", () => measures.map(m => ({ id: m.estimate_id, value: formatEstimateValue(m), interval: formatEstimateInterval(m), geometry: m.value === null ? null : metricGeometry(m.value, m.unit, m.interval_low, m.interval_high, getBurdenScaleDomain(m, measures) ?? undefined), domain: getBurdenScaleDomain(m, measures) })), "digest");
  rec.record("presentation/local", () => local.indicators.map(r => ({ id: r.indicator_id, domain: getLocalContextScaleDomain(r, local.indicators) })), "digest");

  return { schema: 1, caseCount: Object.keys(rec.cases).length, cases: rec.cases };
}

export function renderCharacterization(value: Characterization): string {
  // Stable, line-per-case layout so that review diffs show exactly which cases moved.
  const lines = Object.keys(value.cases).sort().map(id => `  ${JSON.stringify(id)}: ${canonicalJson(value.cases[id])}`);
  return `{\n  "schema": ${value.schema},\n  "caseCount": ${value.caseCount},\n  "cases": {\n${lines.map(l => "  " + l).join(",\n")}\n  }\n}\n`;
}

/** Dev helper: `node --experimental-strip-types tests/characterization/capture.ts <out-file>` */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2];
  if (!out) { console.error("usage: capture.ts <output-file>"); process.exit(2); }
  const { writeFileSync } = await import("node:fs");
  const data = buildCharacterization();
  writeFileSync(out, renderCharacterization(data));
  const typeErrors = Object.entries(data.cases).filter(([, v]) => JSON.stringify(v).includes('"name":"TypeError"') && JSON.stringify(v).includes("is not a function"));
  console.log(`wrote ${data.caseCount} cases to ${out}; harness-suspect TypeErrors: ${typeErrors.length}`);
  for (const [id, v] of typeErrors.slice(0, 20)) console.log("  suspect:", id, JSON.stringify(v).slice(0, 200));
}
