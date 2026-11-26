import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlanningBrief, serializeBriefJson, type PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { createAiHandoffEnvelope } from "../src/data/aiHandoff.ts";
import { getEvidenceFreshness, getLocalEvidenceFreshness, getNationalEvidenceFreshness } from "../src/data/evidenceFreshness.ts";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { loadReviewedWvLocalContextArtifact } from "../src/data/reviewedLocalContext.ts";

const meps = loadReviewedMepsArtifact();
const local = loadReviewedWvLocalContextArtifact();
const estimates = meps.burden_domains.flatMap(domain => domain.measures);
const assessed = new Date("2026-11-26T12:00:00Z");

test("national evidence distinguishes survey, publication and retrieval dates", () => {
  assert.deepEqual(getNationalEvidenceFreshness(meps), [{
    source_ref: "meps-hc256-2024",
    source_name: "MEPS HC-256: 2024 Full Year Consolidated Data File",
    source_family: "meps",
    observation_vintage: "2024 survey year",
    source_release: "August 2026",
    source_modified_on: null,
    retrieved_at: "2026-09-26T01:13:36Z",
    reviewed_at: null,
    artifact_version: meps.manifest.artifact_version,
    freshness_state: "fixed_vintage",
    assessed_on: null
  }]);
  assert.deepEqual(getNationalEvidenceFreshness(meps, []), []);
});

test("HRSA has a daily UTC snapshot boundary and ACS retains the full survey period", () => {
  const sameDay = getLocalEvidenceFreshness(local, new Date("2026-09-24T23:59:59Z"));
  const nextDay = getLocalEvidenceFreshness(local, new Date("2026-09-25T00:00:00Z"));
  const priorDay = getLocalEvidenceFreshness(local, new Date("2026-09-23T23:59:59Z"));
  assert.deepEqual(sameDay.map(entry => entry.freshness_state), ["snapshot_as_of", "snapshot_as_of", "fixed_vintage"]);
  assert.deepEqual(nextDay.map(entry => entry.freshness_state), ["stale_snapshot", "stale_snapshot", "fixed_vintage"]);
  assert.deepEqual(priorDay.map(entry => entry.freshness_state), ["unknown", "unknown", "fixed_vintage"]);
  assert.deepEqual(nextDay[2], sameDay[2]);
  assert.equal(nextDay[2]?.observation_vintage, "2020-2024 ACS 5-year estimates");
  assert.equal(nextDay[0]?.assessed_on, "2026-09-25");
  assert.equal(nextDay[0]?.source_release, null);
  assert.equal(nextDay[0]?.source_modified_on, "2026-09-23");
  assert.deepEqual(getLocalEvidenceFreshness(null, assessed), []);
});

test("Brief export and handoff carry timing only for the actual eligible source selection", () => {
  const acs = local.indicators.find(record => record.source_ref === "acs-2024-5year-profile")!;
  const hrsa = local.indicators.find(record => record.source_ref === "hrsa-hpsa-primary-care-current")!;
  const timing = getEvidenceFreshness(meps, local, assessed);
  const context = { ...meps.context, local_context_id: local.manifest.artifact_version };
  const brief = buildPlanningBrief({ context, estimates, evidence: [], dataRequests: [],
    localContext: [acs, { ...hrsa, release_status: "preliminary" }],
    generatedAt: assessed.toISOString(), evidenceFreshness: timing });
  const expected = timing.filter(entry => entry.source_ref === acs.source_ref || entry.source_family === "meps");
  assert.deepEqual(brief.evidence_freshness, expected);
  const exported = JSON.parse(serializeBriefJson(brief)) as PlanningBrief;
  assert.deepEqual(exported.evidence_freshness, expected);
  assert.deepEqual(createAiHandoffEnvelope(brief).payload, exported);

  const changed: PlanningBrief = { ...brief, local_context: [], evidence_freshness: timing };
  const deselected = JSON.parse(serializeBriefJson(changed)) as PlanningBrief;
  assert.deepEqual(deselected.evidence_freshness, expected.filter(entry => entry.source_family === "meps"));

  const wrongVersion = timing.map(entry => ({ ...entry, artifact_version: "superseded" }));
  const stale = JSON.parse(serializeBriefJson({ ...brief, evidence_freshness: wrongVersion })) as PlanningBrief;
  assert.equal(Object.hasOwn(stale, "evidence_freshness"), false);
});
