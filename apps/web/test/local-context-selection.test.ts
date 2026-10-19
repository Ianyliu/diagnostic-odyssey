import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidLocalContextArtifact,
  type LocalContextArtifact
} from "@diagnostic-odyssey/contracts";
import {
  clearLocalContextSelection,
  createEmptyLocalContextSelection,
  createLocalContextSelectionForArtifact,
  isSelectableLocalContextRecord,
  resolveSelectedLocalContext,
  updateLocalContextSelection
} from "../src/data/localContextSelection.ts";

const artifactPath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json",
    import.meta.url
  )
);

const rawArtifact: unknown = JSON.parse(readFileSync(artifactPath, "utf8"));
assertValidLocalContextArtifact(rawArtifact);
const reviewedArtifact: LocalContextArtifact = rawArtifact;

const firstLoaded = reviewedArtifact.indicators.find(record => record.state === "loaded");
assert.ok(firstLoaded);

test("eligible reviewed WV context starts selected, but unresolved loading stays empty", () => {
  const initial = createEmptyLocalContextSelection();
  assert.deepEqual(initial, {artifactVersion: null, indicatorIds: []});
  assert.deepEqual(resolveSelectedLocalContext(initial, "loading", null), []);

  const loaded = createLocalContextSelectionForArtifact(reviewedArtifact);
  assert.equal(loaded.artifactVersion, reviewedArtifact.manifest.artifact_version);
  const eligible = reviewedArtifact.indicators.filter(isSelectableLocalContextRecord);
  assert.deepEqual(loaded.indicatorIds, eligible.map(record => record.indicator_id));
  assert.deepEqual(resolveSelectedLocalContext(loaded, "loaded", reviewedArtifact), eligible);
  assert.deepEqual(resolveSelectedLocalContext(loaded, "loading", reviewedArtifact), []);
});

test("reviewed loaded record can be selected, deselected, and cleared", () => {
  let selection = clearLocalContextSelection(reviewedArtifact);
  selection = updateLocalContextSelection(
    selection,
    reviewedArtifact,
    firstLoaded.indicator_id,
    true
  );

  assert.deepEqual(selection.indicatorIds, [firstLoaded.indicator_id]);
  assert.deepEqual(
    resolveSelectedLocalContext(selection, "loaded", reviewedArtifact),
    [firstLoaded]
  );

  selection = updateLocalContextSelection(
    selection,
    reviewedArtifact,
    firstLoaded.indicator_id,
    false
  );
  assert.deepEqual(selection.indicatorIds, []);

  selection = updateLocalContextSelection(
    selection,
    reviewedArtifact,
    firstLoaded.indicator_id,
    true
  );
  assert.deepEqual(
    clearLocalContextSelection(reviewedArtifact),
    {
      artifactVersion: reviewedArtifact.manifest.artifact_version,
      indicatorIds: []
    }
  );
});

test("reviewed partial record can be selected and resolves with partial state", () => {
  const artifact = structuredClone(reviewedArtifact);
  const record = artifact.indicators[0]!;
  record.state = "partial";

  const selection = updateLocalContextSelection(
    clearLocalContextSelection(artifact),
    artifact,
    record.indicator_id,
    true
  );
  const selected = resolveSelectedLocalContext(selection, "loaded", artifact);

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.indicator_id, record.indicator_id);
  assert.equal(selected[0]?.state, "partial");
});

test("unknown IDs and ineligible preliminary, empty, error, or suppressed records fail closed", () => {
  const variants = [
    {release_status: "preliminary" as const, state: "loaded" as const},
    {release_status: "reviewed_released" as const, state: "empty" as const},
    {release_status: "reviewed_released" as const, state: "error" as const},
    {release_status: "reviewed_released" as const, state: "suppressed" as const}
  ];

  for (const variant of variants) {
    const artifact = structuredClone(reviewedArtifact);
    const record = artifact.indicators[0]!;
    record.release_status = variant.release_status;
    record.state = variant.state;

    const selection = updateLocalContextSelection(
      createLocalContextSelectionForArtifact(artifact),
      artifact,
      record.indicator_id,
      true
    );

    assert.deepEqual(selection.indicatorIds, []);
    assert.deepEqual(resolveSelectedLocalContext(selection, "loaded", artifact), []);
  }

  const unknownSelection = updateLocalContextSelection(
    clearLocalContextSelection(reviewedArtifact),
    reviewedArtifact,
    "wv.unknown.indicator",
    true
  );
  assert.deepEqual(unknownSelection.indicatorIds, []);
});

test("manipulated selection state cannot export unknown or ineligible records", () => {
  const artifact = structuredClone(reviewedArtifact);
  const preliminary = artifact.indicators[0]!;
  preliminary.release_status = "preliminary";

  const manipulated = {
    artifactVersion: artifact.manifest.artifact_version,
    indicatorIds: [
      preliminary.indicator_id,
      firstLoaded.indicator_id,
      "wv.unknown.indicator"
    ]
  };

  const selected = resolveSelectedLocalContext(manipulated, "loaded", artifact);
  assert.deepEqual(
    selected.map(record => record.indicator_id),
    firstLoaded.indicator_id === preliminary.indicator_id
      ? []
      : [firstLoaded.indicator_id]
  );
  assert.ok(selected.every(record => record.release_status === "reviewed_released"));
  assert.ok(selected.every(record => record.state === "loaded" || record.state === "partial"));
});

test("local-context failure or artifact version rotation yields no stale selected records", () => {
  const selected = updateLocalContextSelection(
    clearLocalContextSelection(reviewedArtifact),
    reviewedArtifact,
    firstLoaded.indicator_id,
    true
  );

  assert.deepEqual(resolveSelectedLocalContext(selected, "error", null), []);

  const rotated = structuredClone(reviewedArtifact);
  rotated.manifest.artifact_version = reviewedArtifact.manifest.artifact_version + "-rotated";

  assert.deepEqual(resolveSelectedLocalContext(selected, "loaded", rotated), []);

  const reset = updateLocalContextSelection(
    selected,
    rotated,
    firstLoaded.indicator_id,
    true
  );
  assert.equal(reset.artifactVersion, rotated.manifest.artifact_version);
  assert.deepEqual(reset.indicatorIds, [firstLoaded.indicator_id]);
});
