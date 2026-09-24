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
import {
  buildPlanningBrief,
  serializeBriefJson
} from "@diagnostic-odyssey/brief-core";
import {
  createLocalContextSelectionForArtifact,
  deriveBriefContextWithSelectedLocalContext,
  resolveSelectedLocalContext,
  updateLocalContextSelection
} from "../src/data/localContextSelection.ts";
import {
  formatPublishedLocalContextUncertainty,
  getLocalContextSelectionAccessibility
} from "../src/data/localContextPresentation.ts";

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

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("Brief local-context provenance is exact, selection-bound, and serializable", () => {
  const zeroContext = deriveBriefContextWithSelectedLocalContext(
    reviewedBundle.context,
    "loaded",
    reviewedLocalContext,
    []
  );
  const zeroBrief = buildPlanningBrief({
    context: zeroContext,
    estimates: reviewedEstimates,
    localContext: [],
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-24T00:00:00Z"
  });

  assert.equal(zeroBrief.context.local_context_id, null);
  assert.deepEqual(zeroBrief.local_context, []);
  assert.equal(
    zeroBrief.context.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(
    zeroBrief.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );

  const selectedRecord = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.acs.uninsured_pct"
  );
  assert.ok(selectedRecord);

  const selectedContext = deriveBriefContextWithSelectedLocalContext(
    reviewedBundle.context,
    "loaded",
    reviewedLocalContext,
    [selectedRecord]
  );
  const selectedBrief = buildPlanningBrief({
    context: selectedContext,
    estimates: reviewedEstimates,
    localContext: [selectedRecord],
    evidence: reviewedBundle.evidence,
    dataRequests: reviewedBundle.data_requests,
    generatedAt: "2026-09-24T00:00:00Z"
  });

  assert.equal(
    selectedBrief.context.local_context_id,
    "local-context-wv-hrsa-acs-candidate-20260924T052332Z"
  );
  assert.equal(
    selectedBrief.context.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(
    selectedBrief.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.deepEqual(
    selectedBrief.local_context.map(record => record.indicator_id),
    ["wv.acs.uninsured_pct"]
  );

  const serialized = JSON.parse(serializeBriefJson(selectedBrief)) as {
    context: {local_context_id: string | null; artifact_version: string};
    artifact_version: string;
    local_context: Array<{indicator_id: string}>;
  };
  assert.equal(
    serialized.context.local_context_id,
    "local-context-wv-hrsa-acs-candidate-20260924T052332Z"
  );
  assert.equal(
    serialized.context.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(
    serialized.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.deepEqual(
    serialized.local_context.map(record => record.indicator_id),
    ["wv.acs.uninsured_pct"]
  );

  const errorContext = deriveBriefContextWithSelectedLocalContext(
    reviewedBundle.context,
    "error",
    null,
    [selectedRecord]
  );
  assert.equal(errorContext.local_context_id, null);
});

test("stale artifact rotation cannot leave a local_context_id in the Brief context", () => {
  const selectedRecord = reviewedLocalContext.indicators[0]!;
  let selection = createLocalContextSelectionForArtifact(reviewedLocalContext);
  selection = updateLocalContextSelection(
    selection,
    reviewedLocalContext,
    selectedRecord.indicator_id,
    true
  );

  const rotatedArtifact = structuredClone(reviewedLocalContext);
  rotatedArtifact.manifest.artifact_version += "-rotated";
  const staleResolution = resolveSelectedLocalContext(
    selection,
    "loaded",
    rotatedArtifact
  );
  assert.deepEqual(staleResolution, []);

  const staleContext = deriveBriefContextWithSelectedLocalContext(
    reviewedBundle.context,
    "loaded",
    rotatedArtifact,
    staleResolution
  );
  assert.equal(staleContext.local_context_id, null);
});

test("selection checkbox accessibility metadata is unique and uses the displayed title", () => {
  const displayOverride = (indicatorId: string): string | undefined =>
    indicatorId === "wv.hrsa.primary-care.max-score" ||
    indicatorId === "wv.hrsa.mental-health.max-score"
      ? "Maximum source-published HPSA score among included designations"
      : undefined;

  const metadata = reviewedLocalContext.indicators.map(record =>
    getLocalContextSelectionAccessibility(
      record,
      displayOverride(record.indicator_id)
    )
  );

  assert.equal(metadata.length, 34);
  assert.equal(new Set(metadata.map(item => item.controlId)).size, 34);
  assert.equal(new Set(metadata.map(item => item.titleId)).size, 34);
  assert.equal(new Set(metadata.map(item => item.accessibleName)).size, 34);

  const primaryCount = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count"
  );
  const mentalCount = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.hrsa.mental-health.designated-distinct-count"
  );
  assert.ok(primaryCount);
  assert.ok(mentalCount);

  const primaryAccessibility = getLocalContextSelectionAccessibility(primaryCount);
  const mentalAccessibility = getLocalContextSelectionAccessibility(mentalCount);
  assert.notEqual(
    primaryAccessibility.accessibleName,
    mentalAccessibility.accessibleName
  );
  assert.match(primaryAccessibility.accessibleName, /Distinct currently Designated Primary Care HPSA IDs/);
  assert.match(mentalAccessibility.accessibleName, /Distinct currently Designated Mental Health HPSA IDs/);

  const primaryMax = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.hrsa.primary-care.max-score"
  );
  const mentalMax = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.hrsa.mental-health.max-score"
  );
  assert.ok(primaryMax);
  assert.ok(mentalMax);

  const displayedTitle =
    "Maximum source-published HPSA score among included designations";
  const primaryMaxAccessibility =
    getLocalContextSelectionAccessibility(primaryMax, displayedTitle);
  const mentalMaxAccessibility =
    getLocalContextSelectionAccessibility(mentalMax, displayedTitle);

  assert.equal(primaryMaxAccessibility.displayTitle, displayedTitle);
  assert.equal(mentalMaxAccessibility.displayTitle, displayedTitle);
  assert.match(primaryMaxAccessibility.accessibleName, /Primary Care/);
  assert.match(mentalMaxAccessibility.accessibleName, /Mental Health/);
  assert.notEqual(
    primaryMaxAccessibility.accessibleName,
    mentalMaxAccessibility.accessibleName
  );

  const localPageSource = readSource("../src/pages/LocalContextPage.tsx");
  assert.match(localPageSource, /aria-labelledby={accessibility\.labelledBy}/);
  assert.match(localPageSource, /id={accessibility\.titleId}/);
  assert.match(localPageSource, /id={accessibility\.actionLabelId}/);
  assert.match(localPageSource, /Include in Planning Brief/);
});

test("selected local-context uncertainty is explicit for both ACS and HRSA", () => {
  const acs = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.acs.uninsured_pct"
  );
  const hrsa = reviewedLocalContext.indicators.find(
    record => record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count"
  );
  assert.ok(acs);
  assert.ok(hrsa);

  assert.equal(
    formatPublishedLocalContextUncertainty(acs),
    "±0.2 percentage points · 90% confidence level"
  );
  assert.equal(acs.confidence_level, 0.9);

  assert.equal(hrsa.margin_of_error, null);
  assert.equal(hrsa.confidence_level, null);
  assert.equal(
    formatPublishedLocalContextUncertainty(hrsa),
    "Not applicable / not published"
  );

  const briefSource = readSource("../src/pages/BriefPage.tsx");
  assert.match(briefSource, /Published uncertainty:/);
  assert.match(
    briefSource,
    /formatPublishedLocalContextUncertainty\(record\)/
  );
  assert.doesNotMatch(
    briefSource,
    /record\.margin_of_error !== null &&/
  );
  assert.match(briefSource, /Reviewed local-context artifact:/);
  assert.match(briefSource, /brief\.context\.local_context_id/);
});
