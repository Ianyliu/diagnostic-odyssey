import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  canExportEstimate,
  type ArtifactBundle,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { formatEstimateValue } from "../src/data/formatEstimateValue.ts";
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

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const rawReviewed: unknown = JSON.parse(readFileSync(reviewedArtifactPath, "utf8"));
assertValidArtifactBundle(rawReviewed);
const reviewedBundle: ArtifactBundle = rawReviewed;

const reviewedEstimates = reviewedBundle.burden_domains.flatMap(
  domain => domain.measures
);

test("runtime analytical source points only to the exact reviewed artifact", () => {
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

test("reviewed runtime bundle has 21 release-eligible analytical estimates and no fixture burden", () => {
  assert.equal(
    reviewedBundle.manifest.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(reviewedEstimates.length, 21);
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

test("proportion formatting is percentage-based without changing the underlying value", () => {
  const estimate = {
    value: 0.8167,
    unit: "proportion",
    release_status: "reviewed_released"
  } satisfies Pick<Estimate, "value" | "unit" | "release_status">;

  assert.equal(formatEstimateValue(estimate), "81.7%");
  assert.equal(estimate.value, 0.8167);
});

test("planning defaults are explicit assumptions and do not come from scenario_examples", () => {
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
  assert.equal(reviewedBundle.scenario_examples.length, 0);
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

test("context bar does not claim West Virginia evidence when local context is empty", () => {
  const context = readSource("../src/components/ContextBar.tsx");
  assert.doesNotMatch(context, /West Virginia|WV working context/);
  assert.match(context, /Local context not yet loaded/);
  assert.match(context, /national evidence/);
});

test("local context and intervention-effect routes have principled empty states", () => {
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const evidence = readSource("../src/pages/EvidencePage.tsx");

  assert.match(local, /No reviewed local implementation indicators are loaded yet/);
  assert.match(local, /National MEPS burden remains unchanged by local context/);
  assert.match(local, /Missing local context is not a zero constraint/);

  assert.match(evidence, /No reviewed intervention-effect parameter is loaded/);
  assert.match(evidence, /Unsupported causal effects, savings, ROI, and preventable-cost claims remain unavailable/);
});

test("planning brief exports all 21 reviewed findings and keeps assumptions distinct", () => {
  const scenario = createPlanningScenarioDefaults();
  const scenarioResult = calculateScenario(scenario);
  const brief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: reviewedBundle.local_context,
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
  assert.doesNotMatch(briefSource, /development fixture|Fixture only|Partial fixture/);
});

test("primary routes retain explanatory rendered states rather than null-only secondary paths", () => {
  const app = readSource("../src/App.tsx");
  const pilot = readSource("../src/pages/PilotPage.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  const evidence = readSource("../src/pages/EvidencePage.tsx");
  const brief = readSource("../src/pages/BriefPage.tsx");

  for (const route of ["burden", "pilot", "brief", "local-context", "evidence"]) {
    assert.match(app, new RegExp(`path="${route}"`));
  }
  assert.match(pilot, /No valid planning scenario result is available/);
  assert.match(local, /empty-state/);
  assert.match(evidence, /empty-state/);
  assert.match(brief, /No valid planning scenario result is available/);
});
