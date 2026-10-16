import {test} from "node:test";
import {runPythonJson} from "../../../scripts/testing/run-python-json.ts";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {assertInput,assertEgress,assertCandidate,bindCandidate,canonicalJSON,fingerprint,projectEgress,unavailable,assertOutput,contextKey,snapshotContent,requestProposalId} from "../src/index.ts";
import type {PlanningGuidanceInputV1,VerifiedAuthority,ModelCandidateV1} from "../src/types.ts";
const hex="a".repeat(64);
const authority:VerifiedAuthority={narrative:null,hints:null};
function fixture():PlanningGuidanceInputV1{
 return {schema_version:"pg.v1",captured_at:"2026-10-11T12:30:00Z",
 versions:{national_release_id:"MEPS2024",national_release_sha256:hex,brief_version:"brief1",brief_content_sha256:hex,scenario_revision:"scenario1",scenario_content_sha256:hex,local_release_id:null,local_release_sha256:null,request_policy_id:"templates1",request_policy_sha256:hex},
 context:{condition_id:"long_covid",cohort_id:"adult",population_id:"adults",setting_id:"outpatient",payer_id:"all_payers",geography_id:"national",pathway_step_id:"referral",mechanism_id:"delay"},
 national_estimate_count:21,
 national_findings:[{id:"n1",source_id:"MEPS",estimate_id:"MEPS-EST-1",value:7,unit_code:"persons",role:"national_reviewed",uncertainty_kind:"confidence_interval",lower:5,upper:9}],
 selected_local_context:[],scenario_assumptions:[{id:"a1",source_id:"analyst",value:0.2,unit_code:"fraction",role:"analyst_assumption"}],
 deterministic_results:[{id:"r1",source_id:"engine",value:200,unit_code:"person_months",role:"deterministic_planning_result",metric_code:"person_months"}],
 warnings:[{id:"w1",code:"planning_not_effect"}],gaps:[{id:"g1",pathway_step_id:"referral",mechanism_id:"delay"}],
 request_templates:[{id:"t1",gap_id:"g1",field_codes:["referral_date"],owner_code:"clinic",granularity_code:"aggregate",window_code:"monthly",privacy_code:"aggregate_only"}],
 narrative_admission:{release_sha256:null,review_sha256:null,applicability_sha256:null,applicability_policy_version:null,applicability_policy_sha256:null,references:[]},
 hint_admission:{release_sha256:null,policy_sha256:null,hints:[]}};
}
const clone=<T>(x:T):T=>structuredClone(x);
const candidate=(fp:string):ModelCandidateV1=>({schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:["n1"],options:[],requests:[{template_id:"t1",gap_id:"g1",hint_id:null}]});
test("request proposal ID v2 canonical golden vectors are injective across nullable and sentinel-like IDs",()=>{
 const fixed={snapshotFingerprint:"pg1:"+"f".repeat(64),generationId:"generation1",templateId:"t1",gapId:"g1",hintReleaseSha256:hex};
 const absent=requestProposalId({...fixed,hintId:null});
 const literalNone=requestProposalId({...fixed,hintId:"none"});
 const literalNull=requestProposalId({...fixed,hintId:"null"});
 assert.equal(absent,"pgp1:9e4f12335f8a297e6d0b9625f019106416fcbd1f49fcd7309615add8acf85e1b");
 assert.equal(literalNone,"pgp1:1cb41944cb3e0245cb810f59e5fa4e619b7d5f796492aae536377d77e30c8376");
 assert.equal(literalNull,"pgp1:52edad5c658dab6df2467fb4ef88f3be11d0794c0fa50ea6d8d1ca9754299805");
 assert.equal(new Set([absent,literalNone,literalNull]).size,3);
});
test("same validated snapshot/generation distinguishes missing, none, and null released hints",()=>{
 const x=fixture(),key=contextKey(x.context);
 const release={release_sha256:hex,policy_sha256:hex,hints:[
  {id:"none",template_id:"t1",context_key:key},
  {id:"null",template_id:"t1",context_key:key}
 ]};
 x.hint_admission=structuredClone(release);
 const verified:VerifiedAuthority={narrative:null,hints:structuredClone(release)};
 assertInput(x,verified);
 const fp=fingerprint(x,verified),generation="generation1",at="2026-10-11T12:31:01Z";
 const proposal=(hintId:string|null)=>{
  const c:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[{template_id:"t1",gap_id:"g1",hint_id:hintId}]};
  const out=bindCandidate(x,verified,c,generation,at,fp);
  assertOutput(out,x,verified);
  assert.deepEqual(out.warnings,x.warnings);
  assert.equal(out.sections.requests,"available");
  assert.equal(out.draft_requests[0]?.disposition,"pending");
  assert.equal(out.draft_requests[0]?.hint_id,hintId);
  return out;
 };
 const unhinted=proposal(null),namedNone=proposal("none"),namedNull=proposal("null");
 const a=unhinted.draft_requests[0]!.proposal_id,b=namedNone.draft_requests[0]!.proposal_id,c=namedNull.draft_requests[0]!.proposal_id;
 assert.equal(new Set([a,b,c]).size,3);
 for(const [target,swapped] of [[unhinted,b],[namedNone,a],[unhinted,c],[namedNull,a],[namedNone,c],[namedNull,b]] as const){
  const forged={...target,draft_requests:[{...target.draft_requests[0]!,proposal_id:swapped}]};
  assert.throws(()=>assertOutput(forged,x,verified),/invalid request binding/);
 }
 const invalid:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[{template_id:"t1",gap_id:"g1",hint_id:"unreleased"}]};
 assert.throws(()=>bindCandidate(x,verified,invalid,generation,at,fp),/unknown\/unreleased hint/);
 const badDispo={...unhinted,draft_requests:[{...unhinted.draft_requests[0]!,disposition:"accepted"}]};
 assert.throws(()=>assertOutput(badDispo,x,verified));
 const tamperedNumber={...unhinted,supported_findings:[{...x.national_findings[0]!,value:999}]};
 assert.throws(()=>assertOutput(tamperedNumber,x,verified));
 const tamperedWarn={...unhinted,warnings:[]};
 assert.throws(()=>assertOutput(tamperedWarn,x,verified),/mandatory trusted warning/);
 const tamperedRelease={...unhinted,snapshot_fingerprint:"pg1:"+"0".repeat(64)};
 assert.throws(()=>assertOutput(tamperedRelease,x,verified),/invalid output provenance/);
});
test("zero-admission case still fails closed for all explicit hints including sentinel-like IDs",()=>{
 const x=fixture(),fp=fingerprint(x,authority);
 const c:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[{template_id:"t1",gap_id:"g1",hint_id:null}]};
 const result=bindCandidate(x,authority,c,"generation1","2026-10-11T12:31:01Z",fp);
 assert.equal(result.draft_requests[0]!.hint_id,null);
 assertOutput(result,x,authority);
 for(const hintId of ["none","null","missing"]){
  assert.throws(()=>bindCandidate(x,authority,{...c,requests:[{...c.requests[0]!,hint_id:hintId}]},"generation1","2026-10-11T12:31:01Z",fp),/unknown\/unreleased hint/);
 }
 assert.equal(x.narrative_admission.references.length,0);
 assert.equal(x.hint_admission.hints.length,0);
});

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
test("versioned reproducible SHA-256 golden vectors: ordinary snapshot, mixed-case punctuation",()=>{
 const x=fixture();
 assert.equal(fingerprint(x,authority),"pg1:61fcad8177dc4eebbe2fba04ed7dc092f8d4e464352f6cb5256efdab67103eea");
 x.warnings=[{id:"z",code:"warning_z"},{id:"a_a",code:"warning_underscore"},{id:"a.a",code:"warning_period"},{id:"a-a",code:"warning_dash"},{id:"Z",code:"warning_capital"}];
 assert.equal(canonicalJSON({z:1,Z:2,"a-b":3,a_b:4,"a.B":5}),'{"Z":2,"a-b":3,"a.B":5,"a_b":4,"z":1}');
 assert.equal(fingerprint(x,authority),"pg1:6ccf8b0e4b719ad8f658ba926748c6c30c0057cf7dc7b13ec708fec3db98a805");
 const other=clone(x);other.warnings.reverse();
 assert.equal(fingerprint(other,authority),fingerprint(x,authority));
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
 x.narrative_admission={release_sha256:hex,review_sha256:hex,applicability_sha256:hex,applicability_policy_version:"policy1",applicability_policy_sha256:hex,references:[{id:"ref1",claim_code:"investigate",context_key:key,allowed_use:"planning_option_to_investigate",applicability_decision_id:"decision1"}]};
 assert.throws(()=>assertInput(x,authority));
 x.narrative_admission={release_sha256:null,review_sha256:null,applicability_sha256:null,applicability_policy_version:null,applicability_policy_sha256:null,references:[]};
 x.hint_admission={release_sha256:hex,policy_sha256:hex,hints:[{id:"hint1",template_id:"t1",context_key:key}]};
 assert.throws(()=>assertInput(x,authority));
});
test("input validation is read-only and no scientific/analyst mutation occurs",()=>{
 const x=fixture(),before=canonicalJSON(x),fp=fingerprint(x,authority);
 bindCandidate(x,authority,candidate(fp),"g1","2026-10-11T12:30:01Z",fp);
 assert.equal(canonicalJSON(x),before);
});

test("section states follow trusted evidence when a model omits all findings and drafts",()=>{
 const x=fixture(),fp=fingerprint(x,authority);
 const empty:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[]};
 assertCandidate(empty);
 const original=canonicalJSON(x);
 const out=bindCandidate(x,authority,empty,"generation1","2026-10-11T12:31:01Z",fp);
 // Reviewed findings and request templates exist, but none were model-selected.
 assert.deepEqual(out.sections,{findings:"available",interventions:"insufficient_evidence",requests:"available"});
 assert.equal(out.supported_findings.length,0);
 assert.equal(out.draft_requests.length,0);
 assert.deepEqual(out.warnings,x.warnings);
 assertOutput(out,x,authority);
 assert.equal(canonicalJSON(x),original);
 // The model and downstream output cannot relabel real trusted availability as missing.
 assert.throws(()=>assertOutput({...out,sections:{...out.sections,findings:"insufficient_evidence"}},x,authority),/section state contradicts trusted evidence: findings/);
 assert.throws(()=>assertOutput({...out,sections:{...out.sections,requests:"insufficient_evidence"}},x,authority),/section state contradicts trusted evidence: requests/);
});
test("eligible reviewed narrative evidence remains available without model option selection",()=>{
 const x=fixture(),key=contextKey(x.context);
 const eligible={id:"eligible1",claim_code:"investigate_pathway",context_key:key,allowed_use:"planning_option_to_investigate" as const,applicability_decision_id:"decision1"};
 const reviewed:VerifiedAuthority={narrative:{release_sha256:hex,review_sha256:hex,applicability_sha256:hex,applicability_policy_version:"policy1",applicability_policy_sha256:hex,references:[eligible]},hints:null};
 x.narrative_admission={release_sha256:hex,review_sha256:hex,applicability_sha256:hex,applicability_policy_version:"policy1",applicability_policy_sha256:hex,references:[eligible]};
 assertInput(x,reviewed);
 const fp=fingerprint(x,reviewed);
 const empty:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[]};
 const out=bindCandidate(x,reviewed,empty,"generation1","2026-10-11T12:31:01Z",fp);
 assert.deepEqual(out.sections,{findings:"available",interventions:"available",requests:"available"});
 assert.deepEqual(out.intervention_options,[]);
 assertOutput(out,x,reviewed);
 assert.throws(()=>assertOutput({...out,sections:{...out.sections,interventions:"insufficient_evidence"}},x,reviewed),/section state contradicts trusted evidence: interventions/);
 // Background-only is reviewed material, but not eligible planning-option evidence.
 x.narrative_admission.references[0]={...eligible,allowed_use:"background_context_only"};
 reviewed.narrative!.references[0]={...eligible,allowed_use:"background_context_only"};
 const fpBackground=fingerprint(x,reviewed);
 const backgroundOut=bindCandidate(x,reviewed,{...empty,snapshot_fingerprint:fpBackground},"generation1","2026-10-11T12:31:01Z",fpBackground);
 assert.equal(backgroundOut.sections.interventions,"insufficient_evidence");
 assert.equal(backgroundOut.intervention_options.length,0);
 assertOutput(backgroundOut,x,reviewed);
});
test("zero reviewed findings/templates and no narrative release give independent insufficient sections",()=>{
 const x=fixture();
 x.national_findings=[];
 x.request_templates=[];
 const fp=fingerprint(x,authority);
 const empty:ModelCandidateV1={schema_version:"pg.v1",snapshot_fingerprint:fp,finding_ids:[],options:[],requests:[]};
 const out=bindCandidate(x,authority,empty,"generation1","2026-10-11T12:31:01Z",fp);
 assert.deepEqual(out.sections,{findings:"insufficient_evidence",interventions:"insufficient_evidence",requests:"insufficient_evidence"});
 assertOutput(out,x,authority);
 for(const section of ["findings","interventions","requests"] as const)
  assert.throws(()=>assertOutput({...out,sections:{...out.sections,[section]:"available"}},x,authority),/section state contradicts trusted evidence/);
 // The full national bundle still contains 21 reviewed estimates; this contract subset is empty.
 assert.equal(x.national_estimate_count,21);
});
test("inference unavailable is not a generated success despite independently available inputs",()=>{
 const x=fixture(),out=unavailable(x,authority);
 assert.equal(out.generation.state,"unavailable");
 assert.deepEqual(out.sections,{findings:"unavailable",interventions:"unavailable",requests:"unavailable"});
 assert.deepEqual(out.supported_findings,[]);
 assert.deepEqual(out.draft_requests,[]);
 assertOutput(out,x,authority);
 assert.throws(()=>assertOutput({...out,sections:{...out.sections,findings:"available"}},x,authority),/unavailable model falsely generated/);
});

test("mandatory warnings survive empty model selections and output suppression fails",()=>{
 const x=fixture(),fp=fingerprint(x,authority);
 const out=bindCandidate(x,authority,{...candidate(fp),finding_ids:[]}, "generation1","2026-10-11T12:31:01Z",fp);
 assert.deepEqual(out.warnings,x.warnings);
 assert.throws(()=>assertCandidate({...candidate(fp),warning_ids:[]})); // not even in untrusted schema
 assert.throws(()=>assertOutput({...out,warnings:[]},x,authority),/mandatory trusted warning/);
 assert.throws(()=>assertOutput({...out,warnings:[{id:"w1",code:"roi_verified"}]},x,authority));
});
test("background-only citation is never an intervention grant; policy/context must match verified authority",()=>{
 const x=fixture(),key=contextKey(x.context),grant={id:"option1",claim_code:"planning_only",context_key:key,allowed_use:"planning_option_to_investigate" as const,applicability_decision_id:"review_decision1"};
 const background={...grant,id:"background1",allowed_use:"background_context_only" as const,applicability_decision_id:"review_decision2"};
 const validAuthority:VerifiedAuthority={narrative:{release_sha256:hex,review_sha256:hex,applicability_sha256:hex,applicability_policy_version:"policy1",applicability_policy_sha256:hex,references:[grant,background]},hints:null};
 x.narrative_admission={release_sha256:hex,review_sha256:hex,applicability_sha256:hex,applicability_policy_version:"policy1",applicability_policy_sha256:hex,references:[grant,background]};
 assertInput(x,validAuthority);
 const fp=fingerprint(x,validAuthority),eg=projectEgress(x,validAuthority);
 assert.deepEqual(eg.references,[{id:"option1",claim_code:"planning_only"}]);
 assert.throws(()=>bindCandidate(x,validAuthority,{...candidate(fp),options:[{reference_id:"background1",claim_code:"planning_only"}]},"generation1","2026-10-11T12:31:01Z",fp),/background-only/);
 const out=bindCandidate(x,validAuthority,{...candidate(fp),options:[{reference_id:"option1",claim_code:"planning_only"}]},"generation1","2026-10-11T12:31:01Z",fp);
 assert.equal(out.intervention_options[0]?.applicability_decision_id,"review_decision1");
 assert.equal(out.intervention_options[0]?.disposition,"pending");
 assertOutput(out,x,validAuthority);
 assert.throws(()=>assertOutput({...out,intervention_options:[{...out.intervention_options[0],applicability_decision_id:"forged"}]},x,validAuthority));
 const untrusted=clone(x);untrusted.narrative_admission.references[0]!.allowed_use="background_context_only";
 assert.throws(()=>assertInput(untrusted,validAuthority),/unverified narrative/);
 const stalePolicy=clone(x);stalePolicy.narrative_admission.applicability_policy_version="policy2";
 assert.throws(()=>assertInput(stalePolicy,validAuthority));
 const wrongPayer=clone(x);wrongPayer.context.payer_id="other_payer";
 assert.throws(()=>assertInput(wrongPayer,validAuthority));
 const wrongSetting=clone(x);wrongSetting.context.setting_id="inpatient";
 assert.throws(()=>assertInput(wrongSetting,validAuthority));
});
test("release/scenario content digests bind fingerprints and fail malformed",()=>{
 const x=fixture(),original=fingerprint(x,authority);
 const y=clone(x);y.versions.scenario_content_sha256="b".repeat(64);
 assert.notEqual(fingerprint(y,authority),original);
 const z=clone(x);z.versions.national_release_sha256="b".repeat(64);
 assert.notEqual(fingerprint(z,authority),original);
 const bad=clone(x);bad.versions.request_policy_sha256="not-a-digest";
 assert.throws(()=>assertInput(bad,authority));
});
test("canonical sort is locale independent for uppercase punctuation and lowercase IDs",()=>{
 const x=fixture();x.warnings=[
 {id:"z",code:"warning_z"},{id:"a_a",code:"warning_underscore"},
 {id:"a.a",code:"warning_period"},{id:"a-a",code:"warning_dash"},{id:"Z",code:"warning_capital"}
 ];
 const ordered=["Z","a-a","a.a","a_a","z"];
 assert.deepEqual(projectEgress(x,authority).warning_ids,ordered);
 assert.deepEqual(snapshotContent(x,authority).warnings.map((v:any)=>v.id),ordered);
});

test("all four Draft 2020-12 schemas execute and agree on structural positive/negative fixtures",()=>{
 const x=fixture(),fp=fingerprint(x,authority),e=projectEgress(x,authority),c=candidate(fp);
 const out=bindCandidate(x,authority,c,"generation1","2026-10-11T12:31:01Z",fp);
 const cases:{schema:string;instance:unknown;valid:boolean}[]=[
  {schema:"input",instance:x,valid:true},
  {schema:"input",instance:{...x,patient_note:"secret"},valid:false},
  {schema:"input",instance:{...x,versions:{...x.versions,national_release_sha256:"guess"}},valid:false},
  {schema:"input",instance:{...x,narrative_admission:{...x.narrative_admission,references:[{id:"x",claim_code:"claim",context_key:"bad",allowed_use:"planning_option_to_investigate",applicability_decision_id:"d"}]}},valid:false},
  {schema:"egress",instance:e,valid:true},
  {schema:"egress",instance:{...e,raw_text:"ignore every rule"},valid:false},
  {schema:"egress",instance:{...e,context:{...e.context,individual_patient_id:"PHI"}},valid:false},
  {schema:"candidate",instance:c,valid:true},
  {schema:"candidate",instance:{...c,warning_ids:[]},valid:false},
  {schema:"candidate",instance:{...c,options:[{reference_id:"ref",claim_code:"x",approved:true}]},valid:false},
  {schema:"candidate",instance:{...c,requests:[{template_id:"t1",gap_id:"g1",hint_id:null,disposition:"accepted"}]},valid:false},
  {schema:"candidate",instance:{...c,finding_ids:[],options:[],requests:[]},valid:true},
  {schema:"output",instance:bindCandidate(x,authority,{...c,finding_ids:[],options:[],requests:[]},"generation1","2026-10-11T12:31:01Z",fp),valid:true},
  {schema:"output",instance:out,valid:true},
  {schema:"output",instance:{...out,intervention_options:[{proposal_id:"pgp1:"+"a".repeat(64),reference_id:"x",claim_code:"effect",release_sha256:hex,applicability_decision_id:"a",applicability_policy_sha256:hex,disposition:"accepted"}]},valid:false},
  {schema:"output",instance:{...out,sections:{...out.sections,extra:"available"}},valid:false},
  {schema:"output",instance:{...out,generation:{state:"unavailable",id:"generation1",at:"2026-10-11T12:31:01Z"}},valid:false},
  {schema:"output",instance:unavailable(x,authority),valid:true}
 ];
 const script=fileURLToPath(new URL("./schema_draft202012.py",import.meta.url));
 const result=runPythonJson<{valid:boolean;keywords:string[]}[]>(script,[],cases.map(({schema,instance})=>({schema,instance})),{maxBuffer:1024*1024});
 assert.equal(result.length,cases.length);
 for(let i=0;i<cases.length;i++){
  assert.equal(result[i]?.valid,cases[i]?.valid,JSON.stringify({i,schema:cases[i]?.schema,keywords:result[i]?.keywords}));
 }
 // Runtime-only scientific semantics: schema cannot identify missing trusted warnings or forged admission.
 assert.throws(()=>assertOutput({...out,warnings:[]},x,authority),/mandatory/);
 assert.throws(()=>assertInput({...x,versions:{...x.versions,scenario_content_sha256:"fake"}},authority));
});
