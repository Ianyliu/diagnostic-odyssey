import {test} from "node:test";
import assert from "node:assert/strict";
import {handleSyntheticPreview} from "../api/ai-preview.ts";
import {projectEgress,bindCandidate,assertOutput} from "@diagnostic-odyssey/planning-guidance";
import type {PlanningGuidanceInputV1} from "@diagnostic-odyssey/planning-guidance";

test("retired /api/ai-preview always fails closed with 404 no-store and zero network calls",async()=>{
 const savedFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=(async()=>{calls++;throw Error("must not call network");}) as typeof fetch;
 try{
  const response=await handleSyntheticPreview();
  assert.equal(response.status,404);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(await response.json(),{error:"not_found"});
  const viaFetch=await (await import("../api/ai-preview.ts")).default.fetch();
  assert.equal(viaFetch.status,404);
  assert.deepEqual(await viaFetch.json(),{error:"not_found"});
  assert.equal(calls,0);
 }finally{
  globalThis.fetch=savedFetch;
 }
});

test("offline synthetic planning-guidance binding remains valid without provider execution",()=>{
 const shaZero="0".repeat(64);
 const input:PlanningGuidanceInputV1={
  schema_version:"pg.v1",
  captured_at:"2026-10-25T15:00:00Z",
  versions:{
   national_release_id:"meps-synthetic-v1",
   national_release_sha256:shaZero,
   brief_version:"brief-synthetic-v1",
   brief_content_sha256:shaZero,
   scenario_revision:"scen-synthetic-v1",
   scenario_content_sha256:shaZero,
   local_release_id:null,
   local_release_sha256:null,
   request_policy_id:"req-policy-v1",
   request_policy_sha256:shaZero
  },
  context:{
   condition_id:"long_covid",
   cohort_id:"synthetic_cohort",
   population_id:"adults_18_64",
   setting_id:"national_outpatient",
   payer_id:"all_payers",
   geography_id:"us_national",
   pathway_step_id:"recognition_to_referral",
   mechanism_id:"navigation_support"
  },
  national_estimate_count:21,
  national_findings:[{
   id:"finding_synthetic_1",
   source_id:"synthetic_meps",
   value:10,
   unit_code:"USD_per_person_year",
   role:"national_reviewed",
   estimate_id:"finding_synthetic_1",
   uncertainty_kind:"confidence_interval",
   lower:8,
   upper:12
  }],
  selected_local_context:[],
  scenario_assumptions:[],
  deterministic_results:[],
  warnings:[{id:"warning_synthetic_1",code:"synthetic_not_evidence"}],
  gaps:[{id:"gap_synthetic_1",pathway_step_id:"recognition_to_referral",mechanism_id:"navigation_support"}],
  request_templates:[{
   id:"template_synthetic_1",
   gap_id:"gap_synthetic_1",
   field_codes:["f1"],
   owner_code:"owner_to_confirm",
   granularity_code:"aggregate",
   window_code:"monthly",
   privacy_code:"aggregate_only"
  }],
  narrative_admission:{
   release_sha256:null,
   review_sha256:null,
   applicability_sha256:null,
   applicability_policy_version:null,
   applicability_policy_sha256:null,
   references:[]
  },
  hint_admission:{
   release_sha256:null,
   policy_sha256:null,
   hints:[]
  }
 };
 const authority={narrative:null,hints:null};
 const egress=projectEgress(input,authority);
 const bound=bindCandidate(input,authority,{
  schema_version:"pg.v1",
  snapshot_fingerprint:egress.snapshot_fingerprint,
  finding_ids:["finding_synthetic_1"],
  options:[],
  requests:[{template_id:"template_synthetic_1",gap_id:"gap_synthetic_1",hint_id:null}]
 },"synth_1","2026-10-25T15:00:00Z",egress.snapshot_fingerprint);
 assertOutput(bound,input,authority);
 assert.equal(bound.supported_findings[0]?.value,10);
 assert.equal(bound.sections.interventions,"insufficient_evidence");
 assert.equal(bound.draft_requests[0]?.disposition,"pending");
});
