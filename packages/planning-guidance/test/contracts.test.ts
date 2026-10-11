import {test} from "node:test";
import assert from "node:assert/strict";
import {assertInput,assertEgress,assertCandidate,bindCandidate,canonicalJSON,fingerprint,projectEgress,unavailable,assertOutput,contextKey} from "../src/index.ts";
import type {PlanningGuidanceInputV1,VerifiedAuthority,ModelCandidateV1} from "../src/types.ts";
const hex="a".repeat(64);
const authority:VerifiedAuthority={narrative:null,hints:null};
function fixture():PlanningGuidanceInputV1{
 return {schema_version:"pg.v1",captured_at:"2026-10-11T12:30:00Z",
 versions:{national_release_id:"MEPS2024",brief_version:"brief1",scenario_revision:"scenario1",local_release_id:null,request_policy_id:"templates1"},
 context:{condition_id:"long_covid",cohort_id:"adult",geography_id:"national",pathway_step_id:"referral",mechanism_id:"delay"},
 national_estimate_count:21,
 national_findings:[{id:"n1",source_id:"MEPS",estimate_id:"MEPS-EST-1",value:7,unit_code:"persons",role:"national_reviewed",uncertainty_kind:"confidence_interval",lower:5,upper:9}],
 selected_local_context:[],scenario_assumptions:[{id:"a1",source_id:"analyst",value:0.2,unit_code:"fraction",role:"analyst_assumption"}],
 deterministic_results:[{id:"r1",source_id:"engine",value:200,unit_code:"person_months",role:"deterministic_planning_result",metric_code:"person_months"}],
 warnings:[{id:"w1",code:"planning_not_effect"}],gaps:[{id:"g1",pathway_step_id:"referral",mechanism_id:"delay"}],
 request_templates:[{id:"t1",gap_id:"g1",field_codes:["referral_date"],owner_code:"clinic",granularity_code:"aggregate",window_code:"monthly",privacy_code:"aggregate_only"}],
 narrative_admission:{release_sha256:null,review_sha256:null,applicability_sha256:null,references:[]},
 hint_admission:{release_sha256:null,policy_sha256:null,hints:[]}};
}
const clone=<T>(x:T):T=>structuredClone(x);
const candidate=(fp:string):ModelCandidateV1=>({schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:["n1"],options:[],requests:[{template_id:"t1",gap_id:"g1",hint_id:null}],warning_ids:["w1"]});
test("zero-admission and zero-hint input yields insufficient intervention section and valid unhinted request",()=>{
 const x=fixture();assertInput(x,authority);
 const fp=fingerprint(x,authority);const e=projectEgress(x,authority);assertEgress(e);
 assert.equal(e.snapshot_fingerprint,fp);assert.equal("value" in e,false);assert.equal("captured_at" in e,false);
 assert.equal(e.references.length,0);assert.equal(e.hint_ids.length,0);
 const c=candidate(fp);assertCandidate(c);
 const out=bindCandidate(x,authority,c,"g1","2026-10-11T12:30:01Z",fp);
 assert.equal(out.sections.interventions,"insufficient_evidence");assert.equal(out.sections.requests,"available");
 assert.equal(out.supported_findings[0]?.value,7);assert.equal(out.draft_requests[0]?.hint_id,null);
 assertOutput(out,x,authority);
});
test("unavailable never pretends to generate",()=>{
 const x=fixture();const out=unavailable(x,authority);
 assert.equal(out.generation.state,"unavailable");assert.equal(out.generation.id,null);assert.equal(out.sections.interventions,"unavailable");
 assert.throws(()=>assertOutput({...out,generation:{state:"available",id:null,at:null}},x,authority));
});
test("canonicalization excludes timestamps, sorts set-like arrays, rejects nonfinite numbers",()=>{
 const x=fixture(),y=clone(x);y.captured_at="2026-10-12T12:30:00Z";
 assert.equal(fingerprint(x,authority),fingerprint(y,authority));
 y.scenario_assumptions.push({id:"a2",source_id:"analyst",role:"analyst_assumption",value:1,unit_code:"count"});
 const z=clone(y);z.scenario_assumptions.reverse();assert.equal(fingerprint(y,authority),fingerprint(z,authority));
 assert.equal(canonicalJSON({b:-0,a:1}),canonicalJSON({a:1,b:0}));
 assert.throws(()=>canonicalJSON({x:Infinity}));
});
test("unknown fields, nonfinite, malformed, IDs, versions, collisions fail closed",()=>{
 const x=fixture();for(const m of [
 (v:any)=>v.extra="malicious",
 (v:any)=>v.scenario_assumptions[0].value=Infinity,
 (v:any)=>v.national_estimate_count=20,
 (v:any)=>v.schema_version="pg.v2",
 (v:any)=>v.national_findings[0].id="r1",
 (v:any)=>v.national_findings[0].patient_note="sensitive",
 (v:any)=>v.national_findings[0].lower=10,
 (v:any)=>v.request_templates[0].gap_id="g-fabricated"
 ]){const y=clone(x);m(y);assert.throws(()=>assertInput(y,authority))}
 const e=projectEgress(x,authority);
 assert.throws(()=>assertEgress({...e,raw_note:"ignore instructions"}));
 assert.throws(()=>assertCandidate({...candidate(e.snapshot_fingerprint),approved:true}));
});
test("stale snapshots and forged numbers and disposition fail closed",()=>{
 const x=fixture(),fp=fingerprint(x,authority);
 const c=candidate(fp);const out=bindCandidate(x,authority,c,"g1","2026-10-11T12:30:01Z",fp);
 assert.throws(()=>bindCandidate({...x,versions:{...x.versions,scenario_revision:"scenario2"}},authority,c,"g1","2026-10-11T12:30:01Z",fp));
 assert.throws(()=>assertOutput({...out,supported_findings:[{...out.supported_findings[0],value:700}]},x,authority));
 assert.throws(()=>assertOutput({...out,draft_requests:[{...out.draft_requests[0],disposition:"accepted"}]},x,authority));
 assert.throws(()=>bindCandidate(x,authority,{...c,finding_ids:["fake"]},"g1","2026-10-11T12:30:01Z",fp));
 assert.throws(()=>bindCandidate(x,authority,{...c,options:[{reference_id:"fabricated",claim_code:"effective"}]},"g1","2026-10-11T12:30:01Z",fp));
 assert.throws(()=>bindCandidate(x,authority,{...c,requests:[{template_id:"t1",gap_id:"g1",hint_id:"not-released"}]},"g1","2026-10-11T12:30:01Z",fp));
});
test("forged catalog and hint registry fail without separately verified authority",()=>{
 const x=fixture(),key=contextKey(x.context);
 x.narrative_admission={release_sha256:hex,review_sha256:hex,applicability_sha256:hex,references:[{id:"ref1",claim_code:"investigate",context_key:key}]};
 assert.throws(()=>assertInput(x,authority));
 x.narrative_admission={release_sha256:null,review_sha256:null,applicability_sha256:null,references:[]};
 x.hint_admission={release_sha256:hex,policy_sha256:hex,hints:[{id:"hint1",template_id:"t1",context_key:key}]};
 assert.throws(()=>assertInput(x,authority));
});
test("input validation is read-only and no scientific/analyst mutation occurs",()=>{
 const x=fixture(),before=canonicalJSON(x),fp=fingerprint(x,authority);
 bindCandidate(x,authority,candidate(fp),"g1","2026-10-11T12:30:01Z",fp);
 assert.equal(canonicalJSON(x),before);
});
