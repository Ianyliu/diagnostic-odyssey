import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  assertValidLocalContextArtifact,
  canExportEstimate,
  canLoadReviewedLocalContextArtifact,
  type ArtifactBundle,
  type Estimate,
  type LocalContextArtifact,
  type LocalContextRecord
} from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { formatEstimateValue } from "../src/data/formatEstimateValue.ts";
import { formatLocalContextValue } from "../src/data/formatLocalContextValue.ts";
import {
  assertReviewedWvLocalContextArtifact,
  REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION,
  REVIEWED_WV_LOCAL_CONTEXT_NATIONAL_MEPS_ARTIFACT_VERSION
} from "../src/data/reviewedLocalContextValidation.ts";
import {
  createPlanningScenarioDefaults,
  PLANNING_DEFAULTS_DESCRIPTION,
  PLANNING_DEFAULTS_LABEL
} from "../src/data/planningScenarioDefaults.ts";

const reviewedArtifactPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/bundle.json",
    import.meta.url
  )
);
const reviewedLocalContextPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json",
    import.meta.url
  )
);

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const rawReviewed: unknown = JSON.parse(readFileSync(reviewedArtifactPath, "utf8"));
assertValidArtifactBundle(rawReviewed);
const reviewedBundle: ArtifactBundle = rawReviewed;

const rawReviewedLocalContext: unknown = JSON.parse(
  readFileSync(reviewedLocalContextPath, "utf8")
);
assertValidLocalContextArtifact(rawReviewedLocalContext);
const reviewedLocalContext: LocalContextArtifact = rawReviewedLocalContext;

const reviewedEstimates = reviewedBundle.burden_domains.flatMap(
  domain => domain.measures
);

test("runtime analytical source points only to the exact reviewed national artifact", () => {
  const source = readSource("../src/data/reviewedArtifact.ts");
  const vite = readSource("../vite.config.ts");

  assert.match(
    source,
    /artifacts\/reviewed\/meps-2024-long-covid-candidate-20260923T020607Z\/bundle\.json/
  );
  assert.match(
    source,
    /REVIEWED_MEPS_ARTIFACT_VERSION\s*=\s*\n?\s*"meps-2024-long-covid-candidate-20260923T020607Z"/
  );
  assert.doesNotMatch(source, /artifacts\/examples|fixture-2026-09-v1/);
  assert.doesNotMatch(vite, /artifacts\/examples/);
});

test("runtime local-context source points only to the exact reviewed WV artifact", () => {
  const source = readSource("../src/data/reviewedLocalContext.ts");
  const validation = readSource("../src/data/reviewedLocalContextValidation.ts");

  assert.match(
    source,
    /artifacts\/reviewed\/local-context-wv-hrsa-acs-candidate-20260924T052332Z\/local-context\.json/
  );
  assert.equal(
    REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION,
    "local-context-wv-hrsa-acs-candidate-20260924T052332Z"
  );
  assert.equal(
    REVIEWED_WV_LOCAL_CONTEXT_NATIONAL_MEPS_ARTIFACT_VERSION,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.match(validation, /exact West Virginia state geography/);
  assert.doesNotMatch(source, /artifacts\/examples|fixture-2026-09-v1/);
});

test("reviewed WV loader validation fails closed on release or MEPS-binding mismatch", () => {
  assert.equal(canLoadReviewedLocalContextArtifact(reviewedLocalContext), true);
  assert.doesNotThrow(() => assertReviewedWvLocalContextArtifact(reviewedLocalContext));

  const preliminaryArtifact = structuredClone(reviewedLocalContext);
  preliminaryArtifact.manifest.release_status = "preliminary";
  for (const record of preliminaryArtifact.indicators) {
    record.release_status = "preliminary";
  }
  assert.throws(
    () => assertReviewedWvLocalContextArtifact(preliminaryArtifact),
    /not eligible for reviewed runtime loading/
  );

  const mixedReleaseArtifact = structuredClone(reviewedLocalContext);
  mixedReleaseArtifact.indicators[0]!.release_status = "preliminary";
  assert.throws(
    () => assertReviewedWvLocalContextArtifact(mixedReleaseArtifact),
    /Invalid Diagnostic Odyssey local-context artifact/
  );

  const mismatchedBinding = structuredClone(reviewedLocalContext);
  mismatchedBinding.manifest.national_meps_artifact_version = "different-meps-version";
  assert.throws(
    () => assertReviewedWvLocalContextArtifact(mismatchedBinding),
    /bound to an unexpected national MEPS artifact version/
  );
});

test("reviewed WV runtime layer contains exactly 34 reviewed state indicators", () => {
  assert.equal(reviewedLocalContext.indicators.length, 34);
  assert.equal(reviewedLocalContext.manifest.release_status, "reviewed_released");
  assert.ok(reviewedLocalContext.indicators.every(
    record => record.release_status === "reviewed_released"
  ));
  assert.deepEqual(reviewedLocalContext.geography, {
    geography_name: "West Virginia",
    geography_type: "state",
    state_fips: "54",
    county_fips: null
  });
});

test("reviewed national runtime bundle remains 21 estimates with no local-context mutation", () => {
  assert.equal(
    reviewedBundle.manifest.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(reviewedEstimates.length, 21);
  assert.equal(reviewedBundle.local_context.length, 0);
  assert.ok(reviewedEstimates.every(
    estimate => estimate.release_status === "reviewed_released"
  ));
  assert.ok(reviewedEstimates.every(
    estimate => estimate.display_status === "analytical_artifact"
  ));
  assert.ok(reviewedEstimates.every(canExportEstimate));
  assert.equal(
    reviewedEstimates.filter(estimate =>
      estimate.artifact_version === "fixture-2026-09-v1"
    ).length,
    0
  );
  assert.equal(
    reviewedBundle.sources.filter(source =>
      /synthetic|fixture/i.test(source.source_ref)
    ).length,
    0
  );
});

test("release gate still excludes preliminary and illustrative estimates", () => {
  const reviewed = reviewedEstimates[0];
  assert.ok(reviewed);
  assert.equal(canExportEstimate(reviewed), true);
  assert.equal(
    canExportEstimate({...reviewed, release_status: "preliminary"} as Estimate),
    false
  );
  assert.equal(
    canExportEstimate({...reviewed, display_status: "illustrative"} as Estimate),
    false
  );
});

test("national proportion and local-context values format without mutating underlying values", () => {
  const estimate = {
    value: 0.8167,
    unit: "proportion",
    release_status: "reviewed_released"
  } satisfies Pick<Estimate, "value" | "unit" | "release_status">;

  assert.equal(formatEstimateValue(estimate), "81.7%");
  assert.equal(estimate.value, 0.8167);

  const expected = new Map<string, [string, string]>([
    ["wv.acs.uninsured_pct", ["6.0% ±0.2 percentage points", "Civilian noninstitutionalized population"]],
    ["wv.acs.no_vehicle_pct", ["8.0% ±0.3 percentage points", "Occupied housing units"]],
    ["wv.acs.broadband_pct", ["86.1% ±0.3 percentage points", "Total households"]],
    ["wv.acs.poverty_pct", ["16.7% ±0.4 percentage points", "All people"]]
  ]);

  for (const [indicatorId, [formatted, universe]] of expected) {
    const record = reviewedLocalContext.indicators.find(
      indicator => indicator.indicator_id === indicatorId
    );
    assert.ok(record);
    assert.equal(formatLocalContextValue(record), formatted);
    assert.equal(record.universe, universe);
    assert.equal(record.confidence_level, 0.9);
    assert.equal(record.uncertainty_type, "published_90_percent_margin_of_error");
  }
});

test("planning defaults are explicit assumptions and are unchanged by local context", () => {
  const scenario = createPlanningScenarioDefaults();
  const contextSource = readSource("../src/data/ArtifactContext.tsx");

  assert.equal(scenario.eligible_population, 12000);
  assert.equal(scenario.reach, 0.25);
  assert.equal(scenario.capacity, 3000);
  assert.equal(scenario.baseline_window_months, 12);
  assert.equal(scenario.alternative_window_months, 6);
  assert.equal(scenario.horizon_months, 12);
  assert.equal(scenario.fixed_cost, 300000);
  assert.equal(scenario.per_participant_cost, 300);
  assert.equal(scenario.target_pathway_step, "recognition-to-referral");
  assert.equal(scenario.mechanism, "navigation-support");
  assert.equal(scenario.artifact_version, "planning-assumptions-2026-09-v1");
  assert.match(PLANNING_DEFAULTS_LABEL, /Illustrative planning defaults/);
  assert.match(PLANNING_DEFAULTS_DESCRIPTION, /not reviewed MEPS findings/i);
  assert.match(contextSource, /createPlanningScenarioDefaults\(\)/);
  assert.doesNotMatch(contextSource, /scenario_examples\[0\]/);
  assert.doesNotMatch(contextSource, /localContext.*setScenario|setScenario.*localContext/);
  assert.equal(reviewedBundle.scenario_examples.length, 0);
});

test("ArtifactContext exposes independent local-context state and failure handling", () => {
  const source = readSource("../src/data/ArtifactContext.tsx");
  assert.match(source, /localContext: LocalContextArtifact \| null/);
  assert.match(source, /localContextStatus: "loading" \| "loaded" \| "error"/);
  assert.match(source, /localContextError: string \| null/);
  assert.match(source, /loadReviewedWvLocalContextArtifact\(\)/);
  assert.match(source, /setLocalContextStatus\("error"\)/);
  assert.match(source, /setLocalContext\(null\)/);
  assert.doesNotMatch(source, /bundle\.local_context\s*=/);
  assert.doesNotMatch(source, /fixture-2026-09-v1|artifacts\/examples/);
});

test("reviewed burden UI has no development-fixture labels", () => {
  const burden = readSource("../src/pages/BurdenPage.tsx");
  for (const forbidden of [
    "Fixture values are illustrative",
    "Illustrative / gated",
    "Fixture only"
  ]) {
    assert.doesNotMatch(burden, new RegExp(forbidden));
  }
  assert.match(burden, /Reviewed national MEPS evidence/);
  assert.match(burden, /Gross burden is not attributable burden/);
});

test("ContextBar keeps national evidence and WV implementation context visibly separate", () => {
  const context = readSource("../src/components/ContextBar.tsx");
  assert.match(context, /bundle\.context\.geography_scope/);
  assert.match(context, /Implementation context:/);
  assert.match(context, /localContext\.geography\.geography_name/);
  assert.match(context, /localContext\.geography\.geography_type/);
  assert.doesNotMatch(context, /geography_scope\s*=|bundle\.context\.geography_scope\s*=/);
  assert.equal(reviewedBundle.context.geography_scope, "United States national evidence");
});

test("LocalContextPage uses canonical fields and preserves score/source interpretation boundaries", () => {
  const local = readSource("../src/pages/LocalContextPage.tsx");
  for (const canonicalField of [
    "indicator_id",
    "label",
    "source_agency",
    "source_ref",
    "source_release_vintage",
    "observation_as_of_date",
    "value",
    "unit",
    "universe",
    "confidence_level",
    "uncertainty_type",
    "limitations",
    "allowed_interpretation",
    "prohibited_interpretation",
    "release_status"
  ]) {
    assert.match(local, new RegExp(canonicalField));
  }
  const formatter = readSource("../src/data/formatLocalContextValue.ts");
  assert.match(formatter, /margin_of_error/);
  assert.doesNotMatch(local, /bundle\.local_context/);
  assert.match(local, /Maximum source-published HPSA score among included designations/);
  assert.match(local, /not a statewide shortage severity score/);
  assert.doesNotMatch(local, /WV shortage score/);
  assert.match(local, /2020–2024 ACS 5-year estimates \/ 2024 release/);
  assert.match(local, /No fixture or illustrative local data are substituted/);
});

test("planning brief keeps available WV context unselected until an explicit future handoff", () => {
  const scenario = createPlanningScenarioDefaults();
  const scenarioResult = calculateScenario(scenario);
  const brief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: [],
    scenario: {input: scenario, result: scenarioResult},
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-23T00:00:00Z"
  });

  assert.equal(brief.burden_findings.length, 21);
  assert.equal(brief.local_context.length, 0);
  assert.equal(brief.evidence.length, 0);
  assert.equal(brief.scenario?.input.artifact_version, "planning-assumptions-2026-09-v1");
  assert.ok(brief.warnings.some(warning => /Gross burden is not attributable burden/.test(warning)));
  assert.ok(brief.warnings.some(warning => /Out-of-pocket\/self-family-paid/.test(warning)));
  assert.ok(brief.warnings.some(warning => /K6.*PHQ-2/.test(warning)));
  assert.ok(brief.warnings.some(warning => /ESAQ time measures/.test(warning)));

  const briefSource = readSource("../src/pages/BriefPage.tsx");
  assert.match(briefSource, /Reviewed national burden findings/);
  assert.match(briefSource, /planning assumptions, not observed evidence/);
  assert.match(briefSource, /localContext:\s*\[\]/);
  assert.match(briefSource, /available, but no local context has been selected for this brief/);
  assert.match(briefSource, /explicit analyst selection\/handoff is required/);
  assert.doesNotMatch(briefSource, /localContext:\s*localContext\.indicators/);
  assert.doesNotMatch(briefSource, /development fixture|Fixture only|Partial fixture/);
});

test("local-context failure state leaves national routes conceptually available", () => {
  const context = readSource("../src/data/ArtifactContext.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  assert.match(context, /setLocalContextStatus\("error"\)/);
  assert.match(local, /National MEPS burden, Pilot Planner, and Planning Brief remain usable/);
  assert.match(local, /National MEPS burden remains available and unchanged/);
  assert.doesNotMatch(local, /fixture-2026-09-v1|artifacts\/examples/);
});

test("primary routes retain explanatory rendered states rather than null-only secondary paths", () => {
  const app = readSource("../src/App.tsx");
  const pilot = readSource("../src/pages/PilotPage.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const evidence = readSource("../src/pages/EvidencePage.tsx");
  const brief = readSource("../src/pages/BriefPage.tsx");

  for (const route of ["burden", "pilot", "brief", "local-context", "evidence"]) {
    assert.match(app, new RegExp('path="' + route + '"'));
  }
  assert.match(pilot, /No valid planning scenario result is available/);
  assert.match(local, /empty-state/);
  assert.match(evidence, /empty-state/);
  assert.match(brief, /No valid planning scenario result is available/);
});
