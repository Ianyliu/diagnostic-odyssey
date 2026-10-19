import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  assertValidLocalContextArtifact,
  canExportEstimate,
  canLoadReviewedLocalContextArtifact,
  type ArtifactBundle,
  type Estimate,
  type LocalContextArtifact
} from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../src/data/formatEstimateValue.ts";
import { formatLocalContextValue } from "../src/data/formatLocalContextValue.ts";
import {
  assertReviewedWvLocalContextArtifact,
  assertReviewedWvLocalContextRuntimeCompatibility,
  REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION,
  REVIEWED_WV_LOCAL_CONTEXT_COMPATIBLE_NATIONAL_MEPS_ARTIFACT_VERSIONS,
  REVIEWED_WV_LOCAL_CONTEXT_DECLARED_NATIONAL_MEPS_ARTIFACT_VERSION
} from "../src/data/reviewedLocalContextValidation.ts";
import {
  loadReviewedMepsArtifact,
  REVIEWED_MEPS_ARTIFACT_VERSION
} from "../src/data/reviewedArtifact.ts";
import { loadReviewedWvLocalContextArtifact } from "../src/data/reviewedLocalContext.ts";
import {
  createPlanningScenarioDefaults,
  PLANNING_DEFAULTS_DESCRIPTION,
  PLANNING_DEFAULTS_LABEL
} from "../src/data/planningScenarioDefaults.ts";

const reviewedArtifactPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",
    import.meta.url
  )
);
const reviewedLocalContextPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json",
    import.meta.url
  )
);

const reviewedChecksumPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/SHA256SUMS",
    import.meta.url
  )
);
const reviewedLocalContextChecksumPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/SHA256SUMS",
    import.meta.url
  )
);

const reviewedTypicalRangeChecksumPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/SHA256SUMS",
    import.meta.url
  )
);

const expectedReviewedChecksums = `f5255710da1b53e5d317d768512319453e6a1dab636f92cb0d95abf6db3082f1  bundle.json
a00b136193c90e234e0f1c59dbbfe6afdce68948f4318402311e72d1ffb1bdeb  diagnostics.json
9ce9890fa4234a9be625bfad550034dee60a9ffb0ab64744af34fceef0708567  review-manifest.json
960a8b7c4a7795f901273b64ed1b7c2166f6aa1db8cbf9f7f083ec0167f503c1  hc256-source-metadata.json
d67c3c8ed3121c6cddcb65871d110b28befbeb45b85f106e721c5b78e4220174  github-actions-run-manifest.json
`;
const expectedReviewedTypicalRangeChecksums = `5b32bfb3288a28ce0a57de4d0c3ec75fe1d83c0f19ad481e687b70af4a91eca0  bundle.json
6ea703bde35ff3ee2ddc75c21afcaeb9de8b273dec010255dd59174142ac9767  diagnostics.json
05fa3b743bde8af933bcb52a19cd564038f6416490b444aa073890beccdff994  review-manifest.json
f0f704df6ee8d082c01175d7107103a255e8d480471bfdc9935c4d21d6c96ee2  hc256-source-metadata.json
d1bd1cabd4e116a2db0481524e982819c80a7c567a5e1e7e27c06b60ada893a3  github-actions-run-manifest.json
`;
const expectedReviewedLocalContextChecksums = `e84a84385162cf8db7e8ed996b7caf7acca84be2b161cc44e802a5792dd15afa  acs-source-metadata.json
3dbff0ba734d1a80b13d0298ce024181c690c3f3dcd50cea3c4f48704399a54c  diagnostics.json
f8a501f3c87695e2dd2c9d46cc75a8821af8b009440106e99c4d3641a60cfe5f  github-actions-run-manifest.json
c6f94c8da0c458cb839af03777b098659ae880117d8edb959a8bdc2519efc306  hrsa-source-metadata.json
82e3cc5d5c6bd1d084fddb47b36ca08df76be19ab2a641dbba50b8c59c467bc4  local-context.json
12687fdf7fcf824deda52c4fc4312da2a5b46b0fa1caa3389c4bed6b0b5174d1  review-manifest.json
`;

function assertImmutableReviewedArtifact(
  checksumPath: string,
  expectedChecksumManifest: string
) {
  const checksumManifest = readFileSync(checksumPath, "utf8");
  assert.equal(checksumManifest, expectedChecksumManifest);

  for (const line of checksumManifest.trim().split("\n")) {
    const [expectedHash, fileName] = line.split(/\s{2}/);
    assert.ok(expectedHash);
    assert.ok(fileName);
    const actualHash = createHash("sha256")
      .update(readFileSync(resolve(dirname(checksumPath), fileName)))
      .digest("hex");
    assert.equal(actualHash, expectedHash, `${fileName} must remain byte-identical`);
  }
}

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
    /artifacts\/reviewed\/meps-2024-long-covid-candidate-20260926T011343Z\/bundle\.json/
  );
  assert.match(
    source,
    /REVIEWED_MEPS_ARTIFACT_VERSION\s*=\s*\n?\s*"meps-2024-long-covid-candidate-20260926T011343Z"/
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
    REVIEWED_WV_LOCAL_CONTEXT_DECLARED_NATIONAL_MEPS_ARTIFACT_VERSION,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.deepEqual(
    REVIEWED_WV_LOCAL_CONTEXT_COMPATIBLE_NATIONAL_MEPS_ARTIFACT_VERSIONS,
    [
      "meps-2024-long-covid-candidate-20260923T020607Z",
      "meps-2024-long-covid-candidate-20260926T011343Z"
    ]
  );
  assert.match(validation, /exact West Virginia state geography/);
  assert.doesNotMatch(source, /artifacts\/examples|fixture-2026-09-v1/);
});

test("reviewed WV loader validation fails closed on release or MEPS-binding mismatch", () => {
  assert.equal(canLoadReviewedLocalContextArtifact(reviewedLocalContext), true);
  assert.doesNotThrow(() => assertReviewedWvLocalContextArtifact(reviewedLocalContext));
  assert.doesNotThrow(() =>
    assertReviewedWvLocalContextRuntimeCompatibility(
      "meps-2024-long-covid-candidate-20260923T020607Z"
    )
  );
  assert.doesNotThrow(() =>
    assertReviewedWvLocalContextRuntimeCompatibility(
      "meps-2024-long-covid-candidate-20260926T011343Z"
    )
  );
  assert.throws(
    () =>
      assertReviewedWvLocalContextRuntimeCompatibility(
        "meps-2024-long-covid-candidate-20990101T000000Z"
      ),
    /not explicitly reviewed-compatible/
  );
  assert.doesNotThrow(() => loadReviewedWvLocalContextArtifact());

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
    "meps-2024-long-covid-candidate-20260926T011343Z"
  );
  assert.equal(REVIEWED_MEPS_ARTIFACT_VERSION, reviewedBundle.manifest.artifact_version);
  assert.equal(
    loadReviewedMepsArtifact().manifest.artifact_version,
    REVIEWED_MEPS_ARTIFACT_VERSION
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

test("activated runtime exposes exactly the two reviewed Typical Ranges", () => {
  const summaries = reviewedEstimates
    .filter(estimate => estimate.distribution_summary !== undefined)
    .sort((a, b) => a.estimate_id.localeCompare(b.estimate_id));

  assert.deepEqual(
    summaries.map(estimate => estimate.estimate_id),
    [
      "meps24-gross-all-cause-spending-mean",
      "meps24-healthcare-paperwork-time-mean"
    ]
  );
  assert.deepEqual(
    [
      summaries[0]!.distribution_summary!.p25,
      summaries[0]!.distribution_summary!.p50,
      summaries[0]!.distribution_summary!.p75
    ],
    [1116, 3624, 14840]
  );
  assert.deepEqual(
    [
      summaries[1]!.distribution_summary!.p25,
      summaries[1]!.distribution_summary!.p50,
      summaries[1]!.distribution_summary!.p75
    ],
    [0, 3, 12]
  );
  for (const estimate of summaries) {
    assert.ok(
      estimate.distribution_summary!.limitations.some(limitation =>
        /not a confidence interval/i.test(limitation)
      )
    );
  }

  const brief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: [],
    scenario: null,
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-26T00:00:00Z"
  });
  assert.deepEqual(
    brief.burden_findings
      .filter(estimate => estimate.distribution_summary !== undefined)
      .map(estimate => estimate.estimate_id)
      .sort(),
    summaries.map(estimate => estimate.estimate_id)
  );
  assert.match(serializeBriefJson(brief), /"distribution_summary"/);

  const presentation = readSource("../src/components/DistributionSummaryText.tsx");
  assert.match(presentation, /Typical Range \(25th–75th percentile\)/);
  assert.match(presentation, /Median:/);
});

test("WV context does not mutate Typical Range or Pilot planning assumptions", () => {
  const summarySnapshot = reviewedEstimates
    .filter(estimate => estimate.distribution_summary !== undefined)
    .map(estimate => structuredClone(estimate.distribution_summary));
  const scenario = createPlanningScenarioDefaults();
  const scenarioSnapshot = structuredClone(scenario);
  const selectedLocal = reviewedLocalContext.indicators[0]!;

  const brief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: [selectedLocal],
    scenario: null,
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-26T00:00:00Z"
  });
  const summaryAfter = brief.burden_findings
    .filter(estimate => estimate.distribution_summary !== undefined)
    .map(estimate => estimate.distribution_summary);

  assert.deepEqual(summaryAfter, summarySnapshot);
  assert.deepEqual(scenario, scenarioSnapshot);
  assert.equal(brief.local_context.length, 1);
});

test("all durable reviewed artifact checksum manifests and payload bytes remain unchanged", () => {
  assertImmutableReviewedArtifact(reviewedChecksumPath, expectedReviewedChecksums);
  assertImmutableReviewedArtifact(
    reviewedTypicalRangeChecksumPath,
    expectedReviewedTypicalRangeChecksums
  );
  assertImmutableReviewedArtifact(
    reviewedLocalContextChecksumPath,
    expectedReviewedLocalContextChecksums
  );
});

test("reviewed point estimates and intervals share native unit formatting", () => {
  const byId = (estimateId: string): Estimate => {
    const estimate = reviewedEstimates.find(item => item.estimate_id === estimateId);
    assert.ok(estimate);
    return estimate;
  };

  const cases: Array<[string, string, string]> = [
    [
      "meps24-office-based-provider-visits-any",
      "81.7%",
      "95% CI 77.2%–86.1%"
    ],
    [
      "meps24-gross-all-cause-spending-total",
      "$97.3B",
      "95% CI $72.0B–$122.5B"
    ],
    [
      "meps24-gross-all-cause-spending-mean",
      "$14,238",
      "95% CI $10,668–$17,807"
    ],
    [
      "meps24-current-long-covid-population",
      "6.8M",
      "95% CI 5.9M–7.7M"
    ],
    [
      "meps24-office-based-provider-visits-mean",
      "12.4 visits/person/year",
      "95% CI 9.4–15.4 visits/person/year"
    ]
  ];

  for (const [estimateId, point, interval] of cases) {
    const estimate = byId(estimateId);
    assert.equal(formatEstimateValue(estimate), point);
    assert.equal(formatEstimateInterval(estimate), interval);
  }
});

test("unavailable interval endpoints remain unavailable and never become zero", () => {
  const source = reviewedEstimates.find(
    estimate => estimate.estimate_id === "meps24-current-long-covid-population"
  );
  assert.ok(source);

  const missingLow: Estimate = {...source, interval_low: null};
  const missingHigh: Estimate = {...source, interval_high: null};

  assert.equal(formatEstimateInterval(missingLow), "95% CI not available");
  assert.equal(formatEstimateInterval(missingHigh), "95% CI not available");
  assert.doesNotMatch(formatEstimateInterval(missingLow), /\b0(?:\.0)?\b/);
  assert.doesNotMatch(formatEstimateInterval(missingHigh), /\b0(?:\.0)?\b/);
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
  const burdenMeasures = readSource("../src/components/BurdenMeasureList.tsx");
  assert.match(burden, /<BurdenMeasureList estimates=\{domain\.measures\} \/>/);
  assert.match(burdenMeasures, /formatEstimateInterval\(estimate\)/);
  assert.match(burdenMeasures, /canExportEstimate\(estimate\)/);
  assert.match(burdenMeasures, /aria-hidden="true"/);
  assert.match(burdenMeasures, /sr-only/);
  assert.match(burdenMeasures, /\\d\+.*confidence interval/);
  assert.match(burden, /intervalMethods\.length > 0/);
  assert.match(burdenMeasures, /measure-interval/);
  assert.match(
    burden,
    /Intervals shown are the reviewed 95% confidence intervals from the MEPS survey-weighted analysis/
  );
  assert.match(burden, /About these intervals/);
  assert.match(burden, /no interval is recomputed in the web application/);
  assert.match(burden, /they do not make gross burden attributable or causal/);
});

test("ContextBar keeps national evidence and WV implementation context visibly separate", () => {
  const context = readSource("../src/components/ContextBar.tsx");
  assert.match(context, /bundle\.context\.geography_scope/);
  assert.match(context, /<dt>National burden<\/dt>/);
  assert.match(context, /<dt>Local implementation context<\/dt>/);
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

test("planning brief includes only explicitly supplied release-eligible local context", () => {
  const scenario = createPlanningScenarioDefaults();
  const scenarioResult = calculateScenario(scenario);
  const zeroSelectionBrief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: [],
    scenario: {input: scenario, result: scenarioResult},
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-23T00:00:00Z"
  });

  assert.equal(zeroSelectionBrief.burden_findings.length, 21);
  assert.equal(zeroSelectionBrief.local_context.length, 0);
  assert.equal(zeroSelectionBrief.evidence.length, 0);
  assert.deepEqual(zeroSelectionBrief.scenario?.input, scenario);

  const loadedRecord = reviewedLocalContext.indicators.find(record => record.state === "loaded");
  assert.ok(loadedRecord);
  const partialRecord = structuredClone(
    reviewedLocalContext.indicators.find(record => record.indicator_id !== loadedRecord.indicator_id)
  );
  assert.ok(partialRecord);
  partialRecord.state = "partial";

  const preliminaryRecord = structuredClone(
    reviewedLocalContext.indicators.find(
      record =>
        record.indicator_id !== loadedRecord.indicator_id &&
        record.indicator_id !== partialRecord.indicator_id
    )
  );
  assert.ok(preliminaryRecord);
  preliminaryRecord.release_status = "preliminary";

  const selectedBrief = buildPlanningBrief({
    context: reviewedBundle.context,
    estimates: reviewedEstimates,
    localContext: [loadedRecord, partialRecord, preliminaryRecord],
    scenario: {input: scenario, result: scenarioResult},
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-23T00:00:00Z"
  });

  assert.deepEqual(
    selectedBrief.local_context.map(record => record.indicator_id),
    [loadedRecord.indicator_id, partialRecord.indicator_id]
  );
  assert.equal(selectedBrief.local_context[1]?.state, "partial");
  assert.equal(selectedBrief.burden_findings.length, 21);
  assert.deepEqual(selectedBrief.scenario?.input, scenario);
  assert.deepEqual(selectedBrief.scenario?.result, scenarioResult);
  assert.equal(reviewedBundle.local_context.length, 0);

  const serialized = JSON.parse(serializeBriefJson(selectedBrief)) as {
    local_context: typeof selectedBrief.local_context;
  };
  assert.deepEqual(
    serialized.local_context.map(record => record.indicator_id),
    [loadedRecord.indicator_id, partialRecord.indicator_id]
  );
  assert.equal(serialized.local_context[0]?.source_agency, loadedRecord.source_agency);
  assert.equal(
    serialized.local_context[0]?.source_release_vintage,
    loadedRecord.source_release_vintage
  );
  assert.equal(serialized.local_context[0]?.geography_name, "West Virginia");

  const briefSource = readSource("../src/pages/BriefPage.tsx");
  assert.match(briefSource, /Reviewed national burden findings/);
  assert.match(briefSource, /planning assumptions, not observed evidence/);
  assert.match(briefSource, /formatEstimateInterval\(estimate\)/);
  assert.match(briefSource, /AccessibleEstimateInterval/);
  assert.match(briefSource, /aria-hidden="true"/);
  assert.match(briefSource, /sr-only/);
  assert.match(briefSource, /localContext:\s*briefLocalContext/);
  assert.doesNotMatch(briefSource, /localContext:\s*\[\]/);
  assert.match(briefSource, /formatLocalContextValue\(record\)/);
  assert.match(briefSource, /formatDataStateLabel\(record\.state\)/);
  assert.doesNotMatch(briefSource, /Partial data state/);
  assert.match(briefSource, /source_release_vintage/);
  assert.match(briefSource, /record\.state/);
  assert.match(briefSource, /record\.limitations/);
  assert.match(briefSource, /record\.allowed_interpretation/);
  assert.match(briefSource, /record\.prohibited_interpretation/);
  assert.match(briefSource, /formatPublishedLocalContextUncertainty\(record\)/);
  assert.match(briefSource, /available, but no local context has been selected for this brief or used in Pilot planning/);
  assert.match(briefSource, /Eligible reviewed records are selected for this Brief by default/);
  assert.doesNotMatch(briefSource, /development fixture|Fixture only|Partial fixture/);
});

test("local-context selection UI supports reviewed records without changing Pilot assumptions", () => {
  const localSource = readSource("../src/pages/LocalContextPage.tsx");
  const contextSource = readSource("../src/data/ArtifactContext.tsx");
  const pilotSource = readSource("../src/pages/PilotPage.tsx");

  assert.match(localSource, /Include in Planning Brief/);
  assert.match(localSource, /Review context in Planning Brief/);
  assert.match(localSource, /Select all/);
  assert.match(localSource, /Select none/);
  assert.match(localSource, /selected for Planning Brief/);
  assert.match(localSource, /Include in Planning Brief/);
  assert.match(localSource, /Use in Pilot planning/);
  assert.match(localSource, /separate analyst choices/);
  assert.match(localSource, /Neither changes national burden or Pilot planner numeric assumptions/);
  assert.match(localSource, /BreakdownList/);
  assert.match(localSource, /primaryBreakdowns/);
  assert.match(localSource, /mentalBreakdowns/);
  assert.match(localSource, /acsRecords\.map/);

  assert.match(contextSource, /selectedLocalContextIds: string\[\]/);
  assert.match(contextSource, /selectedLocalContext: LocalContextRecord\[\]/);
  assert.match(contextSource, /setLocalContextSelected/);
  assert.match(contextSource, /clearSelectedLocalContext/);
  assert.match(contextSource, /resolveSelectedLocalContext/);
  assert.match(contextSource, /createLocalContextSelectionForArtifact/);
  assert.doesNotMatch(contextSource, /localContext.*setScenario|setScenario.*localContext/);
  assert.doesNotMatch(localSource, /setScenario/);
  assert.doesNotMatch(pilotSource, /selectedLocalContext|setLocalContextSelected/);
});

test("analytical scope remains truthful for loading, loaded and unavailable local context", () => {
  const scope = readSource("../src/components/ContextBar.tsx");
  assert.match(scope, /useArtifact\(\)/);
  assert.match(scope, /localContextStatus === "loaded"/);
  assert.match(scope, /localContextStatus === "error"/);
  assert.match(scope, /"Unavailable"/);
  assert.match(scope, /"Loading"/);
  assert.match(scope, /implementationContextLabel/);
});

test("local-context failure state leaves national routes conceptually available", () => {
  const context = readSource("../src/data/ArtifactContext.tsx");
  const local = readSource("../src/pages/LocalContextPage.tsx");
  assert.match(context, /setLocalContextStatus\("error"\)/);
  assert.match(local, /National MEPS burden, Pilot planner, and Planning Brief remain usable/);
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
