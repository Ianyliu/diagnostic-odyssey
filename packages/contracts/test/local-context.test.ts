import assert from "node:assert/strict";
import test from "node:test";
import {
  canLoadReviewedLocalContextArtifact,
  validateLocalContextArtifact,
  validateLocalContextRecord,
  type LocalContextArtifact
} from "../src/index.ts";

const baseRecord = {
  indicator_id: "wv.acs.uninsured_pct",
  label: "Uninsured",
  geography_name: "West Virginia",
  geography_type: "state" as const,
  state_fips: "54",
  county_fips: null,
  source_agency: "U.S. Census Bureau",
  source_ref: "acs-2024-5year-profile",
  source_locator: "https://api.census.gov/data/2024/acs/acs5/profile",
  source_release_vintage: "2020-2024 ACS 5-year estimates / 2024 release",
  observation_as_of_date: "2024",
  value: 7.5,
  unit: "percent",
  universe: "Civilian noninstitutionalized population",
  margin_of_error: 0.4,
  confidence_level: 0.9,
  uncertainty_type: "published_90_percent_margin_of_error",
  context_type: "contextual_indicator" as const,
  state: "loaded" as const,
  limitations: ["Contextual implementation indicator only."],
  allowed_interpretation: "Implementation/access context for West Virginia.",
  prohibited_interpretation: [
    "West Virginia Long COVID prevalence",
    "West Virginia Long COVID cost",
    "state-specific Long COVID burden",
    "causal diagnostic-delay effect",
    "causal pilot benefit",
    "causal effect modifier",
    "calibrated access severity score",
    "attributable cost",
    "savings",
    "ROI"
  ],
  release_status: "preliminary" as const
};

const preliminaryArtifact: LocalContextArtifact = {
  manifest: {
    artifact_family: "local_context",
    artifact_version: "local-context-wv-test",
    generated_at: "2026-09-23T00:00:00Z",
    code_commit: "abc123",
    run_id: "test",
    release_status: "preliminary",
    national_meps_artifact_version: "meps-2024-long-covid-candidate-20260923T020607Z",
    national_meps_burden_unchanged: true
  },
  geography: {
    geography_name: "West Virginia",
    geography_type: "state",
    state_fips: "54",
    county_fips: null
  },
  indicators: [baseRecord],
  sources: [{
    source_ref: "acs-2024-5year-profile",
    source_agency: "U.S. Census Bureau",
    source_name: "2024 ACS 5-year Data Profiles",
    source_locator: "https://api.census.gov/data/2024/acs/acs5/profile",
    source_release_vintage: "2020-2024 ACS 5-year estimates / 2024 release",
    observation_as_of_date: "2024",
    retrieved_at: "2026-09-23T00:00:00Z",
    byte_size: 512,
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    published_update_date: null,
    limitations: []
  }]
};

test("ACS local-context records preserve the published 90% MOE semantics", () => {
  assert.deepEqual(validateLocalContextRecord(baseRecord), []);
  const issues = validateLocalContextRecord({...baseRecord, confidence_level: 0.95});
  assert.ok(issues.some(issue => issue.path.endsWith(".confidence_level")));
});

test("local-context artifact is independently validated and preliminary is not runtime-loadable", () => {
  assert.deepEqual(validateLocalContextArtifact(preliminaryArtifact), []);
  assert.equal(canLoadReviewedLocalContextArtifact(preliminaryArtifact), false);

  const reviewed: LocalContextArtifact = {
    ...preliminaryArtifact,
    manifest: {...preliminaryArtifact.manifest, release_status: "reviewed_released"},
    indicators: preliminaryArtifact.indicators.map(record => ({
      ...record,
      release_status: "reviewed_released"
    }))
  };
  assert.equal(canLoadReviewedLocalContextArtifact(reviewed), true);
});

test("reviewed-artifact load gate fails closed on invalid reviewed-looking objects", () => {
  const reviewed: LocalContextArtifact = {
    ...preliminaryArtifact,
    manifest: {...preliminaryArtifact.manifest, release_status: "reviewed_released"},
    indicators: preliminaryArtifact.indicators.map(record => ({
      ...record,
      release_status: "reviewed_released"
    }))
  };

  const changedBurden = structuredClone(reviewed) as unknown as Record<string, unknown>;
  (changedBurden.manifest as Record<string, unknown>).national_meps_burden_unchanged = false;
  assert.equal(canLoadReviewedLocalContextArtifact(changedBurden), false);

  const invalidFips = structuredClone(reviewed) as unknown as Record<string, unknown>;
  (invalidFips.geography as Record<string, unknown>).state_fips = "5X";
  ((invalidFips.indicators as unknown[])[0] as Record<string, unknown>).state_fips = "5X";
  assert.equal(canLoadReviewedLocalContextArtifact(invalidFips), false);

  const badSourceRef = structuredClone(reviewed) as unknown as Record<string, unknown>;
  ((badSourceRef.indicators as unknown[])[0] as Record<string, unknown>).source_ref = "missing-source";
  assert.equal(canLoadReviewedLocalContextArtifact(badSourceRef), false);
});

test("state records fail closed on county FIPS and national-burden mutation semantics", () => {
  const badCounty = validateLocalContextRecord({...baseRecord, county_fips: "54001"});
  assert.ok(badCounty.some(issue => issue.path.endsWith(".county_fips")));

  const mutated = structuredClone(preliminaryArtifact) as unknown as Record<string, unknown>;
  const manifest = mutated.manifest as Record<string, unknown>;
  manifest.national_meps_burden_unchanged = false;
  const issues = validateLocalContextArtifact(mutated);
  assert.ok(issues.some(issue => issue.path.endsWith(".national_meps_burden_unchanged")));
});


test("ACS source provenance fails closed when deterministic hash metadata is absent", () => {
  const missingHash = structuredClone(preliminaryArtifact) as unknown as Record<string, unknown>;
  const source = ((missingHash.sources as unknown[])[0] as Record<string, unknown>);
  source.sha256 = null;
  source.byte_size = null;
  const issues = validateLocalContextArtifact(missingHash);
  assert.ok(issues.some(issue => issue.path.endsWith(".sha256")));
  assert.ok(issues.some(issue => issue.path.endsWith(".byte_size")));
});
