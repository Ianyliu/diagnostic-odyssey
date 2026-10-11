/** Source-grounded PR B candidate package. Tests do not approve or release evidence. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateNarrativeReferenceCatalog } from "../src/index.ts";

const base = new URL("../../../artifacts/candidates/narrative-phase-a-20261011-v2/", import.meta.url);
const load = (name: string): any => JSON.parse(readFileSync(new URL(name, base), "utf8"));
const sha = (name: string) => createHash("sha256").update(readFileSync(new URL(name, base))).digest("hex");
const clone = <T>(value: T): T => structuredClone(value);
const ids = ["CDC26-PC-01", "CDC26-SUPPORT-01", "MAC24-COORD-01", "MAC24-ACCESS-01", "MAC24-REFERRAL-01", "LOC24-ACCESS-01", "LOC24-PATHWAY-01", "LOC24-WAIT-01"];
const v1 = load("frozen-v1/catalog.candidate.json");
const v2 = load("corrected-v2/catalog.candidate.json");
const matrix = load("corrected-v2/source-claim-matrix.json");
const rights = load("corrected-v2/rights-records.json");
const sourceIndex = load("corrected-v2/source-index.json");
const policy = load("corrected-v2/applicability-policy.candidate.json");
const subject = load("corrected-v2/review-subject.json");
const paths = (v: unknown) => validateNarrativeReferenceCatalog(v).map(i => i.path);
const sameIds = (records: any[]) => records.map(x => x.claim_id).sort();

// These checks make no claims about independent scientific approval or source archiving in Git.
test("both frozen catalogs pass merged PR A structural and semantic validation", () => {
  assert.deepEqual(paths(v1), []);
  assert.deepEqual(paths(v2), []);
  assert.deepEqual(sameIds(v1.records), [...ids].sort());
  assert.deepEqual(sameIds(v2.records), [...ids].sort());
});

test("exact candidate files match a deterministic non-self-referential SHA-256 manifest", () => {
  const lines = readFileSync(new URL("SHA256SUMS", base), "utf8").trimEnd().split("\n");
  assert.equal(lines.length, 13);
  for (const line of lines) {
    const match = /^([0-9a-f]{64})[ ]{2}([A-Za-z0-9._/-]+)$/.exec(line);
    assert.ok(match, `bad checksum entry: ${line}`);
    assert.equal(sha(match[2]!), match[1], match[2]!);
  }
  assert.equal(sha("frozen-v1/catalog.candidate.json"), "8c30e9a517aa4a6513c7907f9083561851697dbe423c3d7bd51f363bffad09e7");
  assert.equal(sha("corrected-v2/catalog.candidate.json"), subject.candidate_catalog_sha256);
  assert.equal(sha("corrected-v2/source-claim-matrix.json"), subject.source_claim_matrix_sha256);
  assert.equal(sha("corrected-v2/rights-records.json"), subject.rights_records_sha256);
  assert.equal(sha("corrected-v2/source-index.json"), subject.source_index_sha256);
  assert.equal(sha("corrected-v2/applicability-policy.candidate.json"), subject.applicability_policy_sha256);
  assert.equal(sha("verification/application-context.json"), subject.application_context_sha256);
  assert.equal(sha("corrected-v2/catalog.candidate.json"), policy.candidate_catalog_sha256);
  assert.equal(sha("corrected-v2/source-claim-matrix.json"), policy.source_claim_matrix_sha256);
  assert.equal(sha("corrected-v2/rights-records.json"), policy.rights_records_sha256);
  assert.equal(subject.actual_independent_review, null);
});

test("every frozen v2 record is a candidate with no reviewer, approved wording or effect", () => {
  for (const cat of [v1, v2]) {
    assert.equal(cat.manifest.release_status, "candidate");
    assert.equal(cat.manifest.automatic_release, false);
    assert.equal(cat.manifest.quantitative_effect_eligible, false);
    assert.equal(cat.manifest.review_manifest_sha256, null);
    assert.equal(cat.manifest.applicability_manifest_sha256, null);
    for (const r of cat.records) {
      assert.equal(r.release_status, "candidate", r.claim_id);
      assert.equal(r.reviewer_status, "needs_review", r.claim_id);
      assert.equal(r.approved_claim_wording, null, r.claim_id);
      assert.equal(r.review.reviewer_id, null, r.claim_id);
      assert.equal(r.review.reviewed_at, null, r.claim_id);
      assert.equal(r.quantitative_effect_eligible, false, r.claim_id);
    }
  }
});

test("v1 is not overwritten, and all six research entries are now background only", () => {
  const a = v1.records.find((r: any) => r.claim_id === "MAC24-COORD-01");
  assert.equal(a.allowed_use, "planning_option_to_investigate");
  for (const r of v2.records) {
    if (!r.claim_id.startsWith("CDC")) assert.equal(r.allowed_use, "background_context_only", r.claim_id);
    assert.equal(r.source.source_id, v1.records.find((o: any) => o.claim_id === r.claim_id).source.source_id);
  }
  assert.equal(v2.records.find((r: any) => r.claim_id === "LOC24-WAIT-01").allowed_use, "background_context_only");
});

test("default deny: no approved context or target transfer and no planning eligibility", () => {
  assert.equal(policy.approved_decisions.length, 0);
  assert.equal(policy.allow_rules.length, 0);
  assert.equal(policy.status, "awaiting_independent_review");
  assert.deepEqual(policy.claim_bindings.map((r: any) => r.claim_id).sort(), [...ids].sort());
  for (const r of policy.claim_bindings) {
    assert.equal(r.proposed_target_context, null, r.claim_id);
    assert.equal(r.approved_allowed_use, null, r.claim_id);
    assert.equal(r.reviewer_id, null, r.claim_id);
    assert.equal(r.reviewed_at, null, r.claim_id);
    assert.equal(r.preparation_recommendation, "withhold_current_context", r.claim_id);
  }
  const canRecommend = (id: string): boolean => {
    const r = v2.records.find((x: any) => x.claim_id === id);
    return Boolean(r?.release_status === "reviewed_released" && r?.reviewer_status === "approved" &&
      r?.allowed_use === "planning_option_to_investigate" && policy.allow_rules.some((rule: any) => rule.claim_id === id));
  };
  assert.ok(ids.every(id => !canRecommend(id)), "insufficient_evidence is the valid result for current context");
});

test("CDC raw guidance and rights preimages absent; must never pretend to have a source digest", () => {
  assert.equal(sourceIndex.unavailable_sources.length, 2);
  assert.equal(rights.independent_rights_decision, null);
  for (const r of v2.records.filter((x: any) => x.claim_id.startsWith("CDC"))) {
    assert.equal(r.source.source_sha256, null);
    assert.equal(r.source.retrieved_at, null);
    assert.equal(matrix.find((m: any) => m.claim_id === r.claim_id).source_path, null);
  }
  assert.equal(rights.records.find((r: any) => r.source_id.startsWith("cdc"))?.source_sha256, null);
});

test("source-to-claim matrix and retained external PDF digests agree without creating browser assets", () => {
  assert.deepEqual(matrix.map((r: any) => r.claim_id), ids);
  const expected = new Map([["macewan-2024-care-coordination", "f11be189fa8e7a606b98b782be3acecdb55c00457fffa809c12603980a89d688"],
    ["darbyshire-2024-locomotion", "f86787bf1a5da731b653bd12350d1836e6be847501634fa596d53a4e8075a592"]]);
  for (const r of v2.records) {
    const m = matrix.find((x: any) => x.claim_id === r.claim_id);
    assert.ok(m?.precise_locator);
    assert.equal(m.source_sha256, r.source.source_sha256);
    assert.equal(m.proposed_wording, r.proposed_claim_wording);
    if (expected.has(r.source.source_id)) {
      assert.equal(r.source.source_sha256, expected.get(r.source.source_id));
      assert.equal(rights.records.find((x: any) => x.source_id === r.source.source_id)?.source_sha256,
        r.source.source_sha256);
    }
  }
  for (const s of sourceIndex.sources) assert.match(s.sha256, /^[a-f0-9]{64}$/);
});

test("negative: numeric outcomes, scenario bindings and release fields fail closed", () => {
  for (const change of [
    (x: any) => { x.records[0].effect_size = 0.2; },
    (x: any) => { x.records[0].scenario_parameter = "timing"; },
    (x: any) => { x.records[0].quantitative_effect_eligible = true; },
    (x: any) => { x.manifest.automatic_release = true; },
    (x: any) => { x.manifest.release_status = "reviewed_released"; },
    (x: any) => { x.records[2].release_status = "reviewed_released"; },
    (x: any) => { x.records[2].approved_claim_wording = "Forged approval"; },
    (x: any) => { x.records[2].reviewer_status = "approved"; },
    (x: any) => { x.records[2].source.source_sha256 = null; x.records[2].release_status = "reviewed_not_released"; },
    (x: any) => { x.records.push(clone(x.records[0])); },
    (x: any) => { x.records[3].source.title = "Incorrect identity under same source ID"; }
  ]) {
    const x = clone(v2); change(x);
    assert.notDeepEqual(paths(x), [], "invalid candidate mutation should not pass merged validator");
  }
});

test("negative: policy linkage and recommendation overrides fail independent candidate constraints", () => {
  const check = (c: any, p: any, m: any) =>
    p.approved_decisions.length === 0 && p.allow_rules.length === 0 &&
    p.candidate_catalog_sha256 === sha("corrected-v2/catalog.candidate.json") &&
    p.source_claim_matrix_sha256 === sha("corrected-v2/source-claim-matrix.json") &&
    c.records.length === 8 && c.records.every((r: any) =>
      r.release_status === "candidate" && r.review.reviewed_at === null &&
      (!r.claim_id.startsWith("LOC") || r.allowed_use === "background_context_only")) &&
    m.length === 8;
  assert.equal(check(v2, policy, matrix), true);
  for (const modify of [
    (p: any) => p.allow_rules.push({claim_id: "LOC24-WAIT-01"}),
    (p: any) => p.approved_decisions.push({claim_id: "MAC24-COORD-01"}),
    (p: any) => p.candidate_catalog_sha256 = "a".repeat(64)
  ]) { const p = clone(policy);modify(p);assert.equal(check(v2,p,matrix),false); }
  const c = clone(v2);c.records.find((r: any) => r.claim_id === "LOC24-WAIT-01").allowed_use = "planning_option_to_investigate";
  assert.equal(check(c,policy,matrix), false);
});
