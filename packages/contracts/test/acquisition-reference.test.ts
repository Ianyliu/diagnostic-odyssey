import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateDataRequest, validateArtifactBundle, validateAcquisitionHintReference } from "../src/index.ts";

const base={request_id:"test",target_question:"Question",pathway_step:"recognition-to-referral",fields_needed:["aggregate capacity"],likely_source_owner:"local steward",granularity_time_window:"program/month",rationale:"operational planning",feasibility_privacy_notes:"aggregate only"};
const reference={schema_version:"1",hint_id:"ACQ26-CAPACITY-01",hint_version:"2",registry_sha256:"1".repeat(64),policy_sha256:"2".repeat(64),source_index_sha256:"3".repeat(64),review_sha256:"4".repeat(64),request_fingerprint:"5".repeat(64)};
test("legacy requests remain unchanged; a structurally valid optional reference is not scientific admission",()=>{
  const before=JSON.stringify(base);assert.deepEqual(validateDataRequest(base),[]);assert.equal(JSON.stringify(base),before);
  assert.deepEqual(validateAcquisitionHintReference(reference),[]);
  assert.deepEqual(validateDataRequest({...base,acquisition_hint:reference}),[]);
});
test("optional references reject missing/unknown fields, future versions and digest-shaped invalid metadata",()=>{
  for(const metadata of [null,undefined,[],"id",{}, {...reference,hint_id:"reach"},{...reference,hint_version:"3"},{...reference,wording:"caller snapshot"},{...reference,request_fingerprint:"A".repeat(64)}]) assert.ok(validateDataRequest({...base,acquisition_hint:metadata}).length);
  for(const key of Object.keys(reference)) {const copy={...reference} as Record<string,unknown>;delete copy[key];assert.ok(validateAcquisitionHintReference(copy).length,key);}
});
test("immutable ArtifactBundle validation still rejects malformed optional references and invalid base fields",()=>{
  const bundle=JSON.parse(readFileSync(new URL("../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",import.meta.url),"utf8"));
  assert.deepEqual(validateArtifactBundle(bundle),[]);
  bundle.data_requests=[{...base,acquisition_hint:{hint_id:"unknown"}}];
  assert.ok(validateArtifactBundle(bundle).some(issue=>issue.path.includes("acquisition_hint")));
  bundle.data_requests=[{...base,fields_needed:[3]}];
  assert.ok(validateArtifactBundle(bundle).some(issue=>issue.path.includes("fields_needed")));
});
