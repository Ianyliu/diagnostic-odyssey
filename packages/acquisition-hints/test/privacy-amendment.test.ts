import assert from "node:assert/strict";
import test from "node:test";
import { createAcquisitionResolver, createSensitivityDataRequest, acquisitionResolver } from "../src/index.ts";
import { context, scenario, fixture, digest, readInput } from "./fixture.ts";

const AMENDED = Object.freeze({
  mapping: "5a6ff02ec024f200a785e960a5fea20ef74dae356c4c59a5b5f962411dd05604",
  policy: "5531c472aa795f4c1a4058d35ccf5541ab21832c687f43062b971f0331fb6742",
  subject: "2f747438ed3435927eb7b0a4b4ce2062138b73ca7ae4eda5fd2bc850d891fab2",
  source: "0c607a5ef437b40bbdc599a8a74dbcb887f1f369fef4ca0506f782dd20af53ce"
});
const ORIGINAL = Object.freeze({
  mapping: "9a117d4a2a5ac1c51d1b8d559fb617be4635306767d21ae06d3ee54668989866",
  policy: "2c4370d84f6024157a3f645c6b2c8da3d0691a254dc9407226d81d1abb94e64f",
  subject: "db919797d7e2dd42cd6c44e8154ccd434181bc3de27009931504124721efb436"
});
const amendedMapping = () => readInput("mapping-candidates.privacy-amendment-1.json");
const amendedPolicy = () => readInput("context-policy.privacy-amendment-1.json");
const requestFor = (field: "capacity" | "alternative_window_months") => createSensitivityDataRequest(scenario, field);

test("amended subjects are exact UTF-8 byte preimages; frozen originals and retained sources remain intact", () => {
  assert.equal(digest(amendedMapping()), AMENDED.mapping);
  assert.equal(digest(amendedPolicy()), AMENDED.policy);
  assert.equal(digest(readInput("review-subject.privacy-amendment-1.json")), AMENDED.subject);
  assert.equal(digest(readInput("source-index.json")), AMENDED.source);
  assert.equal(digest(readInput("mapping-candidates.json")), ORIGINAL.mapping);
  assert.equal(digest(readInput("context-policy.candidate.json")), ORIGINAL.policy);
  assert.equal(digest(readInput("review-subject.json")), ORIGINAL.subject);
  const amendedSubject = JSON.parse(readInput("review-subject.privacy-amendment-1.json"));
  const originalSubject = JSON.parse(readInput("review-subject.json"));
  assert.equal(amendedSubject.mapping_candidates_sha256, AMENDED.mapping);
  assert.equal(amendedSubject.context_policy_sha256, AMENDED.policy);
  assert.equal(amendedSubject.source_index_sha256, AMENDED.source);
  assert.equal(originalSubject.mapping_candidates_sha256, ORIGINAL.mapping);
  assert.equal(amendedSubject.actual_independent_review, null);
  assert.equal(originalSubject.actual_independent_review, null);
  const mapping = JSON.parse(amendedMapping());
  const policy = JSON.parse(amendedPolicy());
  assert.equal(mapping.released, false);
  assert.deepEqual(mapping.approved_hint_ids, []);
  assert.deepEqual(policy.approved_decisions, []);
  assert.equal(policy.mapping_candidates_sha256, AMENDED.mapping);
  assert.equal(policy.source_index_sha256, AMENDED.source);
  assert.deepEqual(mapping.hints.map((h: any) => h.candidate_hint_id), ["ACQ26-TIMING-01", "ACQ26-CAPACITY-01"]);
});

test("revised timing words are exact and capacity's frozen wording is unchanged", () => {
  const revised = JSON.parse(amendedMapping());
  const original = JSON.parse(readInput("mapping-candidates.json"));
  const timing = revised.hints.find((h: any) => h.candidate_hint_id === "ACQ26-TIMING-01");
  const capacity = revised.hints.find((h: any) => h.candidate_hint_id === "ACQ26-CAPACITY-01");
  const oldCapacity = original.hints.find((h: any) => h.candidate_hint_id === "ACQ26-CAPACITY-01");
  assert.deepEqual(capacity, oldCapacity);
  assert.match(timing.proposed_guidance_wording, /only locally approved aggregate interval distributions and episode counts/);
  assert.match(timing.proposed_guidance_wording, /local steward must retain person- or episode-level dates, identifiers and linkage records/);
  assert.match(timing.minimum_necessary_output, /no person- or episode-level outputs/);
  assert.match(timing.privacy_limits.join(" "), /differencing/);
  assert.doesNotMatch(timing.proposed_guidance_wording, /aggregate or de-identified/);
  assert.doesNotMatch(JSON.parse(amendedPolicy()).proposed_rule.allowed_use, /aggregate\/de-identified|aggregate or de-identified/);
});

test("amended mapping/policy cannot be silently paired with original preimages or forged review identities", () => {
  const valid = fixture();
  for (const altered of [
    {...valid.bytes, mapping: readInput("mapping-candidates.json")},
    {...valid.bytes, policy: readInput("context-policy.candidate.json")},
    {...valid.bytes, review: readInput("review-subject.privacy-amendment-1.json")},
    {...valid.bytes, sourceIndex: readInput("source-index.json")+" "}
  ]) {
    const resolver = createAcquisitionResolver(altered, valid.pins);
    assert.equal(resolver.attach(requestFor("capacity"), context, scenario).state, "artifact_unavailable");
  }
  const canonical = createAcquisitionResolver(valid.bytes, valid.pins);
  const attached = canonical.attach(requestFor("capacity"), context, scenario).request;
  const alteredReviewer = fixture(o => {o.review.reviewer = "FORGED REVIEW AUTHORITY";});
  assert.equal(createAcquisitionResolver(alteredReviewer.bytes, alteredReviewer.pins).resolve(attached,context,scenario).state, "stale_reference");
  assert.notEqual(digest(fixture(undefined, "original").bytes.mapping), AMENDED.mapping);
});

test("the effective guidance and export payload are aggregate-only, and individual-record injection fails closed", () => {
  const f = fixture(); const resolver = createAcquisitionResolver(f.bytes, f.pins);
  for (const field of ["capacity", "alternative_window_months"] as const) {
    const result = resolver.attach(requestFor(field), context, scenario);
    assert.equal(result.state, "reviewed");
    const guidance = result.guidance!;
    const userFacing = [
      guidance.wording, guidance.minimum_necessary_output, guidance.local_only_preparation,
      guidance.privacy_limits.join(" "), guidance.privacy_boundary
    ].join(" ");
    assert.match(userFacing, /aggregate/i);
    assert.doesNotMatch(userFacing, /aggregate or de-identified|aggregate\/de-identified outputs only/i);
    assert.match(guidance.privacy_boundary, /No individual-level intervals, raw dates, identifiers/);
  }
  assert.equal(acquisitionResolver.attach(requestFor("capacity"), context, scenario).state, "awaiting_admission");
  for (const alteration of [
    (o: any) => {o.mapping.hints[0].minimum_necessary_output="Provide person-level interval records";},
    (o: any) => {o.mapping.hints[0].proposed_guidance_wording="Request de-identified interval summaries and person-level dates";},
    (o: any) => {o.mapping.hints[0].minimum_necessary_output="De-identified interval summaries";},
    (o: any) => {o.mapping.hints[1].minimum_necessary_output="Send employee roster records";}
  ]) {
    const invalid = fixture(alteration);
    assert.equal(createAcquisitionResolver(invalid.bytes,invalid.pins).attach(requestFor("capacity"),context,scenario).state,"artifact_unavailable");
  }
});

test("stale amended policy, scenario and request fingerprints cannot reuse a previous synthetic attachment", () => {
  const first=fixture();const resolver=createAcquisitionResolver(first.bytes,first.pins);
  const attached=resolver.attach(requestFor("alternative_window_months"),context,scenario).request;
  assert.equal(resolver.resolve(attached,context,scenario).state,"reviewed");
  const changedPolicy=fixture(o=>{o.policy.proposed_rule.allowed_use += " New candidate policy";});
  assert.equal(createAcquisitionResolver(changedPolicy.bytes,changedPolicy.pins).resolve(attached,context,scenario).state,"stale_reference");
  assert.equal(resolver.resolve(attached,context,{...scenario,scenario_id:"new-scenario"}).state,"stale_reference");
  assert.equal(resolver.resolve({...attached,fields_needed:[...attached.fields_needed,"record-level exports"]},context,scenario).state,"not_applicable");
});
