import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  assertValidReviewedLinkedConditionPackage,
  linkedConditionCandidateIds,
  validateLinkedConditionCandidateManifest,
  validateReviewedLinkedConditionCandidateSnapshot,
  validateReviewedLinkedConditionDiagnostics,
  validateReviewedLinkedConditionSources,
  type ArtifactBundle
} from "../src/index.ts";

const reviewedRoot = new URL(
  "../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/",
  import.meta.url
);
const readText = (name: string): string =>
  readFileSync(fileURLToPath(new URL(name, reviewedRoot)), "utf8");
const readJson = (name: string): unknown => JSON.parse(readText(name));
const clone = <T>(value: T): T => structuredClone(value);
const hasPath = (
  issues: ReadonlyArray<{path: string; message: string}>,
  fragment: string
): boolean => issues.some(issue => issue.path.includes(fragment));

test("reviewed linked-condition package validates as a separate runtime-inactive family", () => {
  assert.doesNotThrow(() => assertValidReviewedLinkedConditionPackage({
    candidateFile: readJson("linked-condition-candidate-estimates.json"),
    reviewedDiagnostics: readJson("reviewed-diagnostics.json"),
    sourceMetadata: readJson("source-metadata.json"),
    runManifest: readJson("github-actions-run-manifest.json"),
    reviewManifest: readJson("review-manifest.json"),
    productPolicy: readJson("product-policy.json")
  }));

  assert.deepEqual(
    validateLinkedConditionCandidateManifest(readJson("candidate-manifest.json")),
    []
  );
});

test("candidate to reviewed promotion freezes exact six-record numerical and precision snapshot", () => {
  const candidate = readJson("linked-condition-candidate-estimates.json") as {
    candidates: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  assert.deepEqual(validateReviewedLinkedConditionCandidateSnapshot(candidate), []);
  assert.deepEqual(
    candidate.candidates.map(record => record.candidate_id),
    [...linkedConditionCandidateIds]
  );
  assert.ok(candidate.candidates.every(record => record.product_release_eligible === false));

  const drift = clone(candidate);
  drift.candidates[0]!.value = 0.05;
  assert.ok(hasPath(
    validateReviewedLinkedConditionCandidateSnapshot(drift),
    "u09_linked_service_use_person_share.value"
  ));

  const precisionDrift = clone(candidate);
  precisionDrift.candidates[1]!.precision_status = "meps_precise";
  assert.ok(hasPath(
    validateReviewedLinkedConditionCandidateSnapshot(precisionDrift),
    "u09_linked_service_use_encounters_mean.precision_status"
  ));
});

test("frozen precision states and reason codes remain exact", () => {
  const candidate = readJson("linked-condition-candidate-estimates.json") as {
    candidates: Array<Record<string, unknown>>;
  };
  const byId = new Map(candidate.candidates.map(record => [record.candidate_id, record]));
  const expected = {
    u09_linked_service_use_person_share:
      ["meps_precise", [], "reportable"],
    u09_linked_service_use_encounters_mean:
      ["meps_questionable_precision", ["rse_30_to_50"], "reportable_with_caution"],
    u09_linked_service_use_office_encounters_mean:
      ["meps_questionable_precision", ["rse_30_to_50"], "reportable_with_caution"],
    u09_linked_service_use_outpatient_encounters_mean:
      ["meps_unstable_precision", ["rse_above_50"], "suppress_precision"],
    u09_linked_service_use_emergency_encounters_mean:
      ["meps_unstable_precision", ["rse_above_50"], "suppress_precision"],
    u09_linked_service_use_inpatient_encounters_mean:
      ["unsupported_zero", ["zero_positive_support"], "suppress_unsupported_zero"]
  } as const;

  for (const id of linkedConditionCandidateIds) {
    const record = byId.get(id);
    assert.ok(record);
    const state = expected[id];
    assert.equal(record.precision_status, state[0]);
    assert.deepEqual(record.precision_reason_codes, state[1]);
    assert.equal(record.precision_reporting_status, state[2]);
    assert.equal(record.precision_rule_version, "meps_hc_precision_v1");
    assert.equal(record.product_release_eligible, false);
  }
});

test("Issue 20 reconciliation is immutable and fail-closed", () => {
  const diagnostics = readJson("reviewed-diagnostics.json") as {
    reconciliation: Record<string, unknown>;
    [key: string]: unknown;
  };
  assert.deepEqual(validateReviewedLinkedConditionDiagnostics(diagnostics), []);

  const drift = clone(diagnostics);
  drift.reconciliation.target_unique_events_n = 108;
  assert.ok(hasPath(
    validateReviewedLinkedConditionDiagnostics(drift),
    "target_unique_events_n"
  ));

  const multiplicity = clone(diagnostics);
  multiplicity.reconciliation.events_with_additional_non_u09_condition_link_n = 115;
  assert.ok(hasPath(
    validateReviewedLinkedConditionDiagnostics(multiplicity),
    "events_with_additional_non_u09_condition_link_n"
  ));
});

test("reviewed source provenance preserves all seven source identities and checksums", () => {
  const sources = readJson("source-metadata.json") as {
    sources: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  assert.deepEqual(validateReviewedLinkedConditionSources(sources), []);
  assert.deepEqual(
    sources.sources.map(source => source.source_id),
    [
      "meps-hc256-2024",
      "meps-hc255-2024",
      "meps-hc254i-2024",
      "meps-hc254g-2024",
      "meps-hc254f-2024",
      "meps-hc254e-2024",
      "meps-hc254d-2024"
    ]
  );

  const drift = clone(sources);
  drift.sources[0]!.archive_sha256 = "0".repeat(64);
  assert.ok(validateReviewedLinkedConditionSources(drift).length > 0);
});

test("reviewed package SHA256SUMS covers every immutable reviewed file", () => {
  const expected = new Map(
    readText("SHA256SUMS").trim().split("\n").map(line => {
      const [hash, name] = line.split(/\s+/);
      assert.ok(hash);
      assert.ok(name);
      return [name, hash] as const;
    })
  );
  assert.deepEqual(
    [...expected.keys()],
    [
      "linked-condition-candidate-estimates.json",
      "candidate-manifest.json",
      "reviewed-diagnostics.json",
      "source-metadata.json",
      "github-actions-run-manifest.json",
      "review-manifest.json",
      "product-policy.json"
    ]
  );
  for (const [name, hash] of expected) {
    const actual = createHash("sha256").update(readText(name)).digest("hex");
    assert.equal(actual, hash, name);
  }
});

test("reviewed package carries no forbidden identifiers or arbitrary row-level objects", () => {
  const names = [
    "linked-condition-candidate-estimates.json",
    "candidate-manifest.json",
    "reviewed-diagnostics.json",
    "source-metadata.json",
    "github-actions-run-manifest.json",
    "review-manifest.json",
    "product-policy.json"
  ];
  const forbidden = new Set(["DUPERSID", "CONDIDX", "EVNTIDX", "CLNKIDX"]);
  const inspect = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspect(entry, path + "[" + index + "]"));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assert.equal(forbidden.has(key), false, path + "." + key);
      if (Array.isArray(entry) && /(rows|records)$/i.test(key)) {
        assert.equal(
          entry.some(item => typeof item === "object" && item !== null),
          false,
          path + "." + key
        );
      }
      inspect(entry, path + "." + key);
    }
  };
  names.forEach(name => inspect(readJson(name), name));
});

test("Candidate A is absent from ordinary national burden ArtifactBundle", () => {
  const nationalPath = fileURLToPath(new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",
    import.meta.url
  ));
  const national = JSON.parse(readFileSync(nationalPath, "utf8")) as ArtifactBundle;
  assert.doesNotThrow(() => assertValidArtifactBundle(national));
  const estimates = national.burden_domains.flatMap(domain => domain.measures);
  assert.equal(estimates.length, 21);
  const serialized = JSON.stringify(national);
  for (const id of linkedConditionCandidateIds) assert.equal(serialized.includes(id), false);
});

test("PR 1 does not wire reviewed linked-condition evidence into active runtime/UI", () => {
  const paths = [
    "../../../apps/web/src/data/reviewedArtifact.ts",
    "../../../apps/web/src/data/ArtifactContext.tsx",
    "../../../apps/web/src/pages/BriefPage.tsx",
    "../../../apps/web/src/pages/OverviewPage.tsx",
    "../../../apps/web/src/pages/PilotPage.tsx",
    "../../../apps/web/src/pages/EvidencePage.tsx",
    "../../../apps/web/src/components/DecisionStateRail.tsx",
    "../../../apps/web/src/pages/DomainPage.tsx"
  ];
  for (const relative of paths) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
    assert.equal(
      source.includes("meps-2024-linked-condition-service-use-reviewed-20260929-v1"),
      false,
      relative
    );
    assert.equal(source.includes("linked_condition_product_policy_v1"), false, relative);
    assert.equal(source.includes("reviewed-linked-condition"), false, relative);
  }
});

test("fail-closed privacy validator rejects explicit forbidden identifiers and row arrays", () => {
  const diagnostics = readJson("reviewed-diagnostics.json") as Record<string, unknown>;
  const forbidden = clone(diagnostics);
  forbidden.DUPERSID = ["not allowed"];
  assert.ok(hasPath(validateReviewedLinkedConditionDiagnostics(forbidden), "DUPERSID"));

  const rows = clone(diagnostics);
  rows.person_rows = [{value: 1}];
  assert.ok(hasPath(validateReviewedLinkedConditionDiagnostics(rows), "person_rows"));
});
