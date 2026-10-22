// Self-contained Vercel function. Three canonical planning-guidance modules are
// mechanically inlined without changing their algorithms. Exact source parity
// is checked by apps/web/test/ai-preview-self-contained.test.ts.
// NO local runtime imports: Vercel's Node function tracing excluded .ts modules.
import {createHash,randomBytes,timingSafeEqual} from "node:crypto";

// BEGIN_CANONICAL_TYPES
const VERSION = "pg.v1" as const;
type Id = string;
type Digest = string;
/** All eight dimensions must be explicitly adjudicated; no implicit wildcard/transfer. */
type Context = {
  condition_id: Id; cohort_id: Id; population_id: Id; setting_id: Id; payer_id: Id;
  geography_id: Id; pathway_step_id: Id; mechanism_id: Id;
};
type NumericRecord = {
  id: Id; source_id: Id; value: number; unit_code: Id;
  role: "national_reviewed"|"local_context"|"analyst_assumption"|"deterministic_planning_result";
};
type AllowedUse = "planning_option_to_investigate"|"background_context_only";
type Reference = {
  id: Id; claim_code: Id; context_key: string;
  allowed_use: AllowedUse; applicability_decision_id: Id;
};
type Hint = {id: Id; template_id: Id; context_key: string};
type PlanningGuidanceInputV1 = {
  schema_version: typeof VERSION;
  captured_at: string; // audit only; deliberately excluded from canonical content
  versions: {
    national_release_id: Id; national_release_sha256: Digest;
    brief_version: Id; brief_content_sha256: Digest;
    scenario_revision: Id; scenario_content_sha256: Digest;
    local_release_id: Id|null; local_release_sha256: Digest|null;
    request_policy_id: Id; request_policy_sha256: Digest;
  };
  context: Context;
  national_estimate_count: 21;
  national_findings: (NumericRecord & {role:"national_reviewed"; estimate_id:Id; uncertainty_kind:"iqr"|"confidence_interval"|"none"; lower:number|null; upper:number|null})[];
  selected_local_context: (NumericRecord & {role:"local_context"; vintage_id:Id})[];
  scenario_assumptions: (NumericRecord & {role:"analyst_assumption"})[];
  deterministic_results: (NumericRecord & {role:"deterministic_planning_result"; metric_code:"person_months"|"planning_count"|"resource_units"})[];
  warnings: {id:Id; code:Id}[];
  gaps: {id:Id; pathway_step_id:Id; mechanism_id:Id}[];
  request_templates: {id:Id; gap_id:Id; field_codes:Id[]; owner_code:Id; granularity_code:Id; window_code:Id; privacy_code:Id}[];
  narrative_admission: {
    release_sha256:Digest|null; review_sha256:Digest|null; applicability_sha256:Digest|null;
    applicability_policy_version:Id|null; applicability_policy_sha256:Digest|null;
    references:Reference[];
  };
  hint_admission: {release_sha256:Digest|null; policy_sha256:Digest|null; hints:Hint[]};
};
/** A separate trusted application verifier must authenticate immutable release and review bytes,
 * external reviewer decisions and exact applicability-policy context; typing/hash shape does not authenticate.
 */
type VerifiedAuthority = {
  narrative:null|{
    release_sha256:Digest; review_sha256:Digest; applicability_sha256:Digest;
    applicability_policy_version:Id; applicability_policy_sha256:Digest;
    references:Reference[];
  };
  hints:null|{release_sha256:Digest; policy_sha256:Digest; hints:Hint[]};
};
type ModelEgressV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string; context:Context;
  finding_ids:Id[]; local_ids:Id[]; assumption_ids:Id[]; result_ids:Id[];
  warning_ids:Id[]; gap_ids:Id[]; template_ids:Id[];
  references:{id:Id;claim_code:Id}[]; hint_ids:Id[];
};
/** Warnings are NOT model-selectable; the trusted app always injects all warnings. */
type ModelCandidateV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string;
  finding_ids:Id[]; options:{reference_id:Id;claim_code:Id}[];
  requests:{template_id:Id;gap_id:Id;hint_id:Id|null}[];
};
type PlanningGuidanceOutputV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string;
  generation:{state:"available"|"unavailable"|"invalid"|"stale";id:Id|null;at:string|null};
  sections:{
    findings:"available"|"insufficient_evidence"|"unavailable";
    interventions:"available"|"insufficient_evidence"|"unavailable";
    requests:"available"|"insufficient_evidence"|"unavailable";
  };
  supported_findings:PlanningGuidanceInputV1["national_findings"];
  intervention_options:{
    proposal_id:string;reference_id:Id;claim_code:Id;release_sha256:Digest;
    review_sha256:Digest;applicability_sha256:Digest;applicability_policy_version:Id;
    applicability_decision_id:Id;applicability_policy_sha256:Digest;
    disposition:"pending";
  }[];
  draft_requests:{
    proposal_id:string;template:PlanningGuidanceInputV1["request_templates"][number];
    hint_id:Id|null;disposition:"pending";
  }[];
  warnings:PlanningGuidanceInputV1["warnings"];
  boundary:"AI_assisted_draft_independently_verify"|"no_model_execution";
};
// END_CANONICAL_TYPES

// BEGIN_CANONICAL_GUARDS
type RecordObject = Record<string,unknown>;
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const SHA=/^[0-9a-f]{64}$/;
const FP=/^pg1:[0-9a-f]{64}$/;
function bad(p:string):never{throw Error("Invalid contract: "+p)}
function obj(x:unknown,p:string,keys:string[]):RecordObject{
 if(!x||typeof x!=="object"||Array.isArray(x))bad(p);
 const o=x as RecordObject;
 for(const k of keys)if(!Object.hasOwn(o,k))bad(p+"."+k+" missing");
 for(const k of Object.keys(o))if(!keys.includes(k))bad(p+"."+k+" extra");
 return o;
}
function id(x:unknown,p:string){if(typeof x!=="string"||!ID.test(x))bad(p)}
function digest(x:unknown,p:string){if(typeof x!=="string"||!SHA.test(x))bad(p)}
function optionalDigest(x:unknown,p:string){if(x!==null)digest(x,p)}
function number(x:unknown,p:string){if(typeof x!=="number"||!Number.isFinite(x))bad(p)}
function list(x:unknown,p:string,max:number,fn:(x:unknown,p:string)=>void){
 if(!Array.isArray(x)||x.length>max)bad(p+" size");
 x.forEach((v,i)=>fn(v,p+"["+i+"]"));return x;
}
function unique<T>(a:T[],key:(x:T)=>string,p:string){const s=new Set<string>();for(const v of a){const k=key(v);if(s.has(k))bad(p+" duplicate");s.add(k)}}
function scalar(x:unknown,p:string,keys:string[]){const o=obj(x,p,keys);for(const k of keys)id(o[k],p+"."+k);return o}
function numeric(x:unknown,p:string,role:string,extra:string[]=[]){
 const o=obj(x,p,["id","source_id","value","unit_code","role",...extra]);for(const k of ["id","source_id","unit_code"])id(o[k],p+"."+k);
 number(o.value,p+".value");if(o.role!==role)bad(p+".role");return o;
}
function ctx(x:unknown,p:string){scalar(x,p,["condition_id","cohort_id","population_id","setting_id","payer_id","geography_id","pathway_step_id","mechanism_id"])}
function contextKey(c:PlanningGuidanceInputV1["context"]){return [c.condition_id,c.cohort_id,c.population_id,c.setting_id,c.payer_id,c.geography_id,c.pathway_step_id,c.mechanism_id].join("|")}
const empty:VerifiedAuthority={narrative:null,hints:null};
function assertInput(x:unknown,authority:VerifiedAuthority=empty):asserts x is PlanningGuidanceInputV1{
 const o=obj(x,"input",["schema_version","captured_at","versions","context","national_estimate_count","national_findings","selected_local_context","scenario_assumptions","deterministic_results","warnings","gaps","request_templates","narrative_admission","hint_admission"]);
 if(o.schema_version!==VERSION||o.national_estimate_count!==21)bad("version or ordinary bundle size");
 if(typeof o.captured_at!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(o.captured_at)||Number.isNaN(Date.parse(o.captured_at)))bad("captured_at");
 const v=obj(o.versions,"versions",["national_release_id","national_release_sha256","brief_version","brief_content_sha256","scenario_revision","scenario_content_sha256","local_release_id","local_release_sha256","request_policy_id","request_policy_sha256"]);
 for(const k of ["national_release_id","brief_version","scenario_revision","request_policy_id"])id(v[k],"versions."+k);
 for(const k of ["national_release_sha256","brief_content_sha256","scenario_content_sha256","request_policy_sha256"])digest(v[k],"versions."+k);
 if(v.local_release_id!==null)id(v.local_release_id,"local_release_id");
 optionalDigest(v.local_release_sha256,"local_release_sha256");
 if((v.local_release_id===null)!==(v.local_release_sha256===null))bad("partial local release identity");
 ctx(o.context,"context");
 const f=list(o.national_findings,"national_findings",21,(x,p)=>{
  const a=numeric(x,p,"national_reviewed",["estimate_id","uncertainty_kind","lower","upper"]);id(a.estimate_id,p+".estimate_id");
  if(!["iqr","confidence_interval","none"].includes(a.uncertainty_kind as string))bad(p+".uncertainty_kind");
  if(a.uncertainty_kind==="none"){if(a.lower!==null||a.upper!==null)bad(p+".bounds")}
  else{number(a.lower,p+".lower");number(a.upper,p+".upper");if((a.lower as number)>(a.upper as number))bad(p+".reversed interval")}
 });unique(f,x=>(x as any).id,"findings");unique(f,x=>(x as any).estimate_id,"estimate ids");
 const loc=list(o.selected_local_context,"selected_local_context",34,(x,p)=>{const a=numeric(x,p,"local_context",["vintage_id"]);id(a.vintage_id,p+".vintage_id")});unique(loc,x=>(x as any).id,"local IDs");
 if(loc.length&&v.local_release_id===null)bad("missing local release");
 const a=list(o.scenario_assumptions,"scenario_assumptions",16,(x,p)=>numeric(x,p,"analyst_assumption"));unique(a,x=>(x as any).id,"assumption IDs");
 const r=list(o.deterministic_results,"deterministic_results",16,(x,p)=>{const q=numeric(x,p,"deterministic_planning_result",["metric_code"]);if(!["person_months","planning_count","resource_units"].includes(q.metric_code as string))bad("unsupported effect/ROI metric")});unique(r,x=>(x as any).id,"result IDs");
 const w=list(o.warnings,"warnings",32,(x,p)=>scalar(x,p,["id","code"]));unique(w,x=>(x as any).id,"warning IDs");
 const g=list(o.gaps,"gaps",24,(x,p)=>{const q=scalar(x,p,["id","pathway_step_id","mechanism_id"]);const c=o.context as PlanningGuidanceInputV1["context"];if(q.pathway_step_id!==c.pathway_step_id||q.mechanism_id!==c.mechanism_id)bad("off-pathway gap")});unique(g,x=>(x as any).id,"gaps");
 const t=list(o.request_templates,"request_templates",24,(x,p)=>{const q=obj(x,p,["id","gap_id","field_codes","owner_code","granularity_code","window_code","privacy_code"]);for(const k of ["id","gap_id","owner_code","granularity_code","window_code","privacy_code"])id(q[k],p+"."+k);const fields=list(q.field_codes,p+".fields",16,id);if(!fields.length)bad("empty fields");unique(fields,x=>x as string,"fields");if(!g.some(z=>(z as any).id===q.gap_id))bad("unknown gap")});unique(t,x=>(x as any).id,"templates");
 const n=obj(o.narrative_admission,"narrative",["release_sha256","review_sha256","applicability_sha256","applicability_policy_version","applicability_policy_sha256","references"]);
 for(const k of ["release_sha256","review_sha256","applicability_sha256","applicability_policy_sha256"])optionalDigest(n[k],k);
 if(n.applicability_policy_version!==null)id(n.applicability_policy_version,"narrative.applicability_policy_version");
 const h=obj(o.hint_admission,"hints",["release_sha256","policy_sha256","hints"]);for(const k of ["release_sha256","policy_sha256"])optionalDigest(h[k],k);
 const c=contextKey(o.context as PlanningGuidanceInputV1["context"]);
 const refs=list(n.references,"references",32,(x,p)=>{const q=obj(x,p,["id","claim_code","context_key","allowed_use","applicability_decision_id"]);
 id(q.id,p+".id");id(q.claim_code,p+".claim_code");id(q.applicability_decision_id,p+".applicability_decision_id");
 if(!["planning_option_to_investigate","background_context_only"].includes(q.allowed_use as string))bad("invalid narrative allowed use");
 if(q.context_key!==c)bad("narrative context mismatch")});unique(refs,x=>(x as any).id,"references");
 const hints=list(h.hints,"hints",32,(x,p)=>{const q=obj(x,p,["id","template_id","context_key"]);id(q.id,p+".id");id(q.template_id,p+".template_id");if(q.context_key!==c||!t.some(z=>(z as any).id===q.template_id))bad("hint mapping mismatch")});unique(hints,x=>(x as any).id,"hints");
 if(n.release_sha256===null||n.review_sha256===null||n.applicability_sha256===null||n.applicability_policy_version===null||n.applicability_policy_sha256===null){
  if(refs.length||n.release_sha256!==null||n.review_sha256!==null||n.applicability_sha256!==null||n.applicability_policy_version!==null||n.applicability_policy_sha256!==null)bad("partial narrative admission");
 }else if(!authority.narrative||n.release_sha256!==authority.narrative.release_sha256||n.review_sha256!==authority.narrative.review_sha256||n.applicability_sha256!==authority.narrative.applicability_sha256||n.applicability_policy_version!==authority.narrative.applicability_policy_version||n.applicability_policy_sha256!==authority.narrative.applicability_policy_sha256||refs.some(z=>!authority.narrative!.references.some(v=>v.id===(z as any).id&&v.claim_code===(z as any).claim_code&&v.context_key===c&&v.allowed_use===(z as any).allowed_use&&v.applicability_decision_id===(z as any).applicability_decision_id)))bad("unverified narrative applicability grant");
 if(h.release_sha256===null||h.policy_sha256===null){
  if(hints.length||h.release_sha256!==null||h.policy_sha256!==null)bad("partial hint admission");
 }else if(!authority.hints||h.release_sha256!==authority.hints.release_sha256||h.policy_sha256!==authority.hints.policy_sha256||hints.some(z=>!authority.hints!.hints.some(v=>v.id===(z as any).id&&v.template_id===(z as any).template_id&&v.context_key===c)))bad("unverified hint registry");
 const seen=new Set<string>();for(const group of [f,loc,a,r,w,g,t,refs,hints])for(const row of group){const k=(row as any).id;if(seen.has(k))bad("cross-namespace ID collision "+k);seen.add(k)}
}
function assertEgress(x:unknown):asserts x is ModelEgressV1{
 const o=obj(x,"egress",["schema_version","snapshot_fingerprint","context","finding_ids","local_ids","assumption_ids","result_ids","warning_ids","gap_ids","template_ids","references","hint_ids"]);
 if(o.schema_version!==VERSION||typeof o.snapshot_fingerprint!=="string"||!FP.test(o.snapshot_fingerprint))bad("egress version/fingerprint");
 ctx(o.context,"context");
 for(const [k,max] of [["finding_ids",21],["local_ids",34],["assumption_ids",16],["result_ids",16],["warning_ids",32],["gap_ids",24],["template_ids",24],["hint_ids",32]] as const){const a=list(o[k],k,max,id);unique(a,x=>x as string,k)}
 const refs=list(o.references,"references",32,(x,p)=>scalar(x,p,["id","claim_code"]));unique(refs,x=>(x as any).id,"references");
}
function assertCandidate(x:unknown):asserts x is ModelCandidateV1{
 const o=obj(x,"candidate",["schema_version","snapshot_fingerprint","finding_ids","options","requests"]);
 if(o.schema_version!==VERSION||typeof o.snapshot_fingerprint!=="string"||!FP.test(o.snapshot_fingerprint))bad("candidate version/fingerprint");
 for(const [k,max] of [["finding_ids",21]] as const){const a=list(o[k],k,max,id);unique(a,x=>x as string,k)}
 const opts=list(o.options,"options",32,(x,p)=>scalar(x,p,["reference_id","claim_code"]));unique(opts,x=>(x as any).reference_id,"options");
 const requests=list(o.requests,"requests",24,(x,p)=>{const q=obj(x,p,["template_id","gap_id","hint_id"]);id(q.template_id,p+".template_id");id(q.gap_id,p+".gap_id");if(q.hint_id!==null)id(q.hint_id,p+".hint_id")});unique(requests,x=>(x as any).template_id,"requests");
}
function validate<T>(x:unknown,fn:(x:unknown)=>asserts x is T):{ok:true;value:T}|{ok:false;error:string}{try{fn(x);return {ok:true,value:x}}catch(e){return {ok:false,error:String(e)}}}
// END_CANONICAL_GUARDS

// BEGIN_CANONICAL_INDEX
const sha=(s:string)=>createHash("sha256").update(s,"utf8").digest("hex");
function canonical(x:unknown):string {
 if(x===null)return "null";
 if(typeof x==="string"||typeof x==="boolean")return JSON.stringify(x);
 if(typeof x==="number"){if(!Number.isFinite(x))throw Error("non-finite canonical number");return JSON.stringify(Object.is(x,-0)?0:x)}
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 if(x&&typeof x==="object"){const o=x as Record<string,unknown>;return "{"+Object.keys(o).sort().map(k=>JSON.stringify(k)+":"+canonical(o[k])).join(",")+"}"}
 throw Error("unsupported canonical value");
}
function canonicalJSON(x:unknown){return canonical(x)}
/** Locale-independent UTF-16 code-unit comparison for canonical IDs. */
const compareIds=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const arrayKeys=["national_findings","selected_local_context","scenario_assumptions","deterministic_results","warnings","gaps","request_templates"];
function snapshotContent(input:PlanningGuidanceInputV1,authority:VerifiedAuthority){
 assertInput(input,authority);
 const {captured_at:__excluded,...rest}=input;void __excluded;
 const copy=structuredClone(rest) as Record<string,any>;
 for(const k of arrayKeys)copy[k].sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 copy.narrative_admission.references.sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 copy.hint_admission.hints.sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 for(const t of copy.request_templates)t.field_codes.sort(compareIds);
 return copy;
}
function fingerprint(input:PlanningGuidanceInputV1,authority:VerifiedAuthority){
 return "pg1:"+sha("DiagnosticOdyssey/PlanningGuidanceSnapshot/v1\n"+canonical(snapshotContent(input,authority)));
}
function projectEgress(input:PlanningGuidanceInputV1,authority:VerifiedAuthority):ModelEgressV1 {
 assertInput(input,authority);
 const out:ModelEgressV1={schema_version:VERSION,snapshot_fingerprint:fingerprint(input,authority),
 context:structuredClone(input.context),
 finding_ids:input.national_findings.map(x=>x.id).sort(compareIds),
 local_ids:input.selected_local_context.map(x=>x.id).sort(compareIds),
 assumption_ids:input.scenario_assumptions.map(x=>x.id).sort(compareIds),
 result_ids:input.deterministic_results.map(x=>x.id).sort(compareIds),
 warning_ids:input.warnings.map(x=>x.id).sort(compareIds),
 gap_ids:input.gaps.map(x=>x.id).sort(compareIds),
 template_ids:input.request_templates.map(x=>x.id).sort(compareIds),
 references:input.narrative_admission.references.filter(x=>x.allowed_use==="planning_option_to_investigate").map(x=>({id:x.id,claim_code:x.claim_code})).sort((a,b)=>compareIds(a.id,b.id)),
 hint_ids:input.hint_admission.hints.map(x=>x.id).sort(compareIds)
 };assertEgress(out);return out;
}
/** Availability is determined exclusively by validated, independently admitted application
 * data—not by which optional IDs or drafts an untrusted model chose to return.
 * A section may be available with zero selected items.
 */
function trustedSectionStates(input:PlanningGuidanceInputV1):PlanningGuidanceOutputV1["sections"] {
 const context=contextKey(input.context);
 return {
  findings:input.national_findings.length>0?"available":"insufficient_evidence",
  interventions:input.narrative_admission.references.some(ref=>
   ref.context_key===context&&ref.allowed_use==="planning_option_to_investigate"
  )?"available":"insufficient_evidence",
  requests:input.request_templates.length>0?"available":"insufficient_evidence"
 };
}
/** Request proposal identity v2: injective with respect to nullable hints.
 * Canonical structured values distinguish `null` from every valid literal hint ID.
 * Domain separation from snapshots, narrative options and historical request IDs.
 */
function requestProposalId(args:{
 snapshotFingerprint:string; generationId:string; templateId:string; gapId:string;
 hintId:string|null; hintReleaseSha256:string|null;
}):string {
 const preimage={
  snapshot_fingerprint:args.snapshotFingerprint,
  generation_id:args.generationId,
  template_id:args.templateId,
  gap_id:args.gapId,
  hint:args.hintId===null
   ? {kind:"absent" as const}
   : {kind:"released" as const,id:args.hintId},
  hint_release_sha256:args.hintReleaseSha256
 };
 return "pgp1:"+sha("DiagnosticOdyssey/PlanningGuidanceRequestProposal/v2\n"+canonical(preimage));
}
const has=(a:{id:string}[],id:string)=>a.some(x=>x.id===id);
function bindCandidate(input:PlanningGuidanceInputV1,authority:VerifiedAuthority,candidate:unknown,generationId:string,generatedAt:string,expectedFingerprint:string):PlanningGuidanceOutputV1{
 assertInput(input,authority);assertCandidate(candidate);
 const fp=fingerprint(input,authority);
 if(fp!==expectedFingerprint||candidate.snapshot_fingerprint!==fp)throw Error("stale snapshot or changed admission/policy");
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(generationId)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(generatedAt)||Number.isNaN(Date.parse(generatedAt)))throw Error("application generation provenance invalid");
 for(const id of candidate.finding_ids)if(!has(input.national_findings,id))throw Error("unknown or fabricated finding");
 // Mandatory scientific warnings are never delegated to or selected by the model.
 const opts=candidate.options.map((x)=>{
  const r=input.narrative_admission.references.find(v=>v.id===x.reference_id&&v.claim_code===x.claim_code&&v.context_key===contextKey(input.context)&&v.allowed_use==="planning_option_to_investigate");
  const n=input.narrative_admission;
  if(!r||!n.release_sha256||!n.review_sha256||!n.applicability_sha256||!n.applicability_policy_version||!n.applicability_policy_sha256)throw Error("unadmitted, background-only or context-ineligible claim");
  return {proposal_id:"pgp1:"+sha("option\n"+fp+"\n"+generationId+"\n"+r.id+"\n"+r.claim_code+"\n"+n.release_sha256+"\n"+n.review_sha256+"\n"+n.applicability_sha256+"\n"+n.applicability_policy_version+"\n"+n.applicability_policy_sha256+"\n"+r.applicability_decision_id),reference_id:r.id,claim_code:r.claim_code,release_sha256:n.release_sha256,review_sha256:n.review_sha256,applicability_sha256:n.applicability_sha256,applicability_policy_version:n.applicability_policy_version,applicability_decision_id:r.applicability_decision_id,applicability_policy_sha256:n.applicability_policy_sha256,disposition:"pending" as const};
 });
 const reqs=candidate.requests.map(x=>{
  const t=input.request_templates.find(v=>v.id===x.template_id&&v.gap_id===x.gap_id);
  if(!t)throw Error("unknown template/gap relationship");
  if(x.hint_id!==null&&!input.hint_admission.hints.some(v=>v.id===x.hint_id&&v.template_id===t.id))throw Error("unknown/unreleased hint");
  return {proposal_id:requestProposalId({snapshotFingerprint:fp,generationId,templateId:t.id,gapId:t.gap_id,hintId:x.hint_id,hintReleaseSha256:input.hint_admission.release_sha256}),template:structuredClone(t),hint_id:x.hint_id,disposition:"pending" as const};
 });
 const result:PlanningGuidanceOutputV1={
 schema_version:VERSION,snapshot_fingerprint:fp,generation:{state:"available",id:generationId,at:generatedAt},
 sections:trustedSectionStates(input),
 supported_findings:input.national_findings.filter(x=>candidate.finding_ids.includes(x.id)).map(x=>structuredClone(x)),
 intervention_options:opts,draft_requests:reqs,warnings:input.warnings.map(x=>structuredClone(x)),
 boundary:"AI_assisted_draft_independently_verify"
 };assertOutput(result,input,authority);return result;
}
function unavailable(input:PlanningGuidanceInputV1,authority:VerifiedAuthority,state:"unavailable"|"invalid"|"stale"="unavailable"):PlanningGuidanceOutputV1{
 const result:PlanningGuidanceOutputV1={schema_version:VERSION,snapshot_fingerprint:fingerprint(input,authority),generation:{state,id:null,at:null},sections:{findings:"unavailable",interventions:"unavailable",requests:"unavailable"},supported_findings:[],intervention_options:[],draft_requests:[],warnings:[],boundary:"no_model_execution"};
 assertOutput(result,input,authority);return result;
}
function assertOutput(out:unknown,input:PlanningGuidanceInputV1,authority:VerifiedAuthority):asserts out is PlanningGuidanceOutputV1 {
 assertInput(input,authority);
 if(!out||typeof out!=="object"||Array.isArray(out))throw Error("invalid output");
 const x=out as Record<string,any>;
 const keys=["schema_version","snapshot_fingerprint","generation","sections","supported_findings","intervention_options","draft_requests","warnings","boundary"];
 if(Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k)))throw Error("unknown output field");
 if(x.schema_version!==VERSION||x.snapshot_fingerprint!==fingerprint(input,authority))throw Error("invalid output provenance");
 const g=x.generation;
 if(!g||Object.keys(g).sort().join(",")!=="at,id,state"||!["available","unavailable","invalid","stale"].includes(g.state))throw Error("invalid generation state");
 const s=x.sections;
 if(!s||Object.keys(s).sort().join(",")!=="findings,interventions,requests"||Object.values(s).some(v=>!["available","insufficient_evidence","unavailable"].includes(v as string)))throw Error("invalid section");
 if(!Array.isArray(x.supported_findings)||!Array.isArray(x.intervention_options)||!Array.isArray(x.draft_requests)||!Array.isArray(x.warnings))throw Error("invalid output collections");
 if(g.state!=="available"){
  if(g.id!==null||g.at!==null||Object.values(s).some(v=>v!=="unavailable")||x.boundary!=="no_model_execution"||[x.supported_findings,x.intervention_options,x.draft_requests,x.warnings].some(a=>a.length))throw Error("unavailable model falsely generated");
  return;
 }
 if(typeof g.id!=="string"||!g.id||typeof g.at!=="string"||Number.isNaN(Date.parse(g.at))||x.boundary!=="AI_assisted_draft_independently_verify")throw Error("invalid generation provenance");
 if(x.supported_findings.length>21||x.intervention_options.length>32||x.draft_requests.length>24||x.warnings.length>32)throw Error("oversized output");
 for(const [key,items,source] of [["supported_findings",x.supported_findings,input.national_findings],["warnings",x.warnings,input.warnings]] as const){
  const seen=new Set<string>();
  for(const row of items){const trusted=source.find((v:any)=>v.id===row.id);if(!trusted||canonical(row)!==canonical(trusted)||seen.has(row.id))throw Error("numerical drift/forged source/duplicate "+key);seen.add(row.id)}
 }
 if(x.warnings.length!==input.warnings.length||canonical([...x.warnings].sort((a:any,b:any)=>compareIds(a.id,b.id)))!==canonical([...input.warnings].sort((a,b)=>compareIds(a.id,b.id))))throw Error("mandatory trusted warning suppressed or changed");
 const proposalIds=new Set<string>();
 for(const op of x.intervention_options){
  if(!op||Object.keys(op).sort().join(",")!=="applicability_decision_id,applicability_policy_sha256,applicability_policy_version,applicability_sha256,claim_code,disposition,proposal_id,reference_id,release_sha256,review_sha256"||op.disposition!=="pending")throw Error("model-owned disposition");
  const ref=input.narrative_admission.references.find(v=>v.id===op.reference_id&&v.claim_code===op.claim_code&&v.context_key===contextKey(input.context)&&v.allowed_use==="planning_option_to_investigate");
  const n=input.narrative_admission;if(!ref||!n.release_sha256||!n.review_sha256||!n.applicability_sha256||!n.applicability_policy_version||!n.applicability_policy_sha256||op.release_sha256!==n.release_sha256||op.review_sha256!==n.review_sha256||op.applicability_sha256!==n.applicability_sha256||op.applicability_policy_version!==n.applicability_policy_version||op.applicability_decision_id!==ref.applicability_decision_id||op.applicability_policy_sha256!==n.applicability_policy_sha256)throw Error("unreleased reference");
  const expected="pgp1:"+sha("option\n"+x.snapshot_fingerprint+"\n"+g.id+"\n"+ref.id+"\n"+ref.claim_code+"\n"+n.release_sha256+"\n"+n.review_sha256+"\n"+n.applicability_sha256+"\n"+n.applicability_policy_version+"\n"+n.applicability_policy_sha256+"\n"+ref.applicability_decision_id);
  if(op.proposal_id!==expected||proposalIds.has(expected))throw Error("invalid proposal binding");proposalIds.add(expected);
 }
 for(const req of x.draft_requests){
  if(!req||Object.keys(req).sort().join(",")!=="disposition,hint_id,proposal_id,template"||req.disposition!=="pending")throw Error("unauthorized request disposition");
  const t=input.request_templates.find(v=>v.id===req.template?.id);
  if(!t||canonical(req.template)!==canonical(t)||req.hint_id!==null&&!input.hint_admission.hints.some(v=>v.id===req.hint_id&&v.template_id===t.id))throw Error("forged request/hint");
  const expected=requestProposalId({snapshotFingerprint:x.snapshot_fingerprint,generationId:g.id,templateId:t.id,gapId:t.gap_id,hintId:req.hint_id,hintReleaseSha256:input.hint_admission.release_sha256});
  if(req.proposal_id!==expected||proposalIds.has(expected))throw Error("invalid request binding");proposalIds.add(expected);
 }
 // Recompute availability from the independently verified input, not model selection.
 // Empty selected arrays are valid even when the trusted section is available.
 const expectedSections=trustedSectionStates(input);
 for(const section of ["findings","interventions","requests"] as const){
  if(s[section]!==expectedSections[section])throw Error("section state contradicts trusted evidence: "+section);
 }
}
// END_CANONICAL_INDEX

// BEGIN_SYNTHETIC_ENDPOINT
type Environment = Record<string, string | undefined>;
const authority: VerifiedAuthority = {narrative:null, hints:null};
const hex = "a".repeat(64);
const modelAllowlist = new Set(["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
const headers = {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};

function json(code:number,data:unknown) {return Response.json(data,{status:code,headers});}

function syntheticInput():PlanningGuidanceInputV1 {
 return {
  schema_version:"pg.v1", captured_at:"2026-10-21T00:00:00Z",
  versions:{national_release_id:"SYNTHETIC",national_release_sha256:hex,
   brief_version:"synthetic",brief_content_sha256:hex,
   scenario_revision:"synthetic",scenario_content_sha256:hex,
   local_release_id:null,local_release_sha256:null,
   request_policy_id:"synthetic",request_policy_sha256:hex},
  context:{condition_id:"synthetic",cohort_id:"synthetic",population_id:"synthetic",
   setting_id:"synthetic",payer_id:"synthetic",geography_id:"synthetic",
   pathway_step_id:"referral",mechanism_id:"delay"},
  national_estimate_count:21,
  national_findings:[{id:"finding_synthetic_1",source_id:"synthetic_fixture",
   estimate_id:"synthetic_estimate_1",value:10,unit_code:"illustrative_units",
   role:"national_reviewed",uncertainty_kind:"none",lower:null,upper:null}],
  selected_local_context:[],scenario_assumptions:[],deterministic_results:[],
  warnings:[{id:"warning_synthetic_1",code:"synthetic_not_evidence"}],
  gaps:[{id:"gap_synthetic_1",pathway_step_id:"referral",mechanism_id:"delay"}],
  request_templates:[{id:"template_synthetic_1",gap_id:"gap_synthetic_1",
   field_codes:["synthetic_referral_date"],owner_code:"synthetic_owner",
   granularity_code:"aggregate",window_code:"monthly",privacy_code:"aggregate_only"}],
  narrative_admission:{release_sha256:null,review_sha256:null,
   applicability_sha256:null,applicability_policy_version:null,
   applicability_policy_sha256:null,references:[]},
  hint_admission:{release_sha256:null,policy_sha256:null,hints:[]}
 };
}

function verifyBearer(header:string|null,secret:string):boolean {
 if(!header?.startsWith("Bearer ")||header.length>2048||secret.length<32)return false;
 return timingSafeEqual(createHash("sha256").update(header.slice(7)).digest(),
  createHash("sha256").update(secret).digest());
}

/** The provider receives only a fixed server-owned synthetic fixture, no browser data. */
export async function handleSyntheticPreview(
 request:Request,env:Environment=process.env,providerFetch:typeof fetch=fetch
):Promise<Response> {
 if(env.VERCEL_ENV!=="preview"||env.AI_PREVIEW_ENABLED!=="on")
  return json(404,{error:"not_found"});
 if(request.method!=="POST")return json(405,{error:"method_not_allowed"});
 if(!env.AI_PREVIEW_TOKEN||!verifyBearer(request.headers.get("authorization"),env.AI_PREVIEW_TOKEN))
  return json(401,{error:"unauthorized"});
 if((await request.text()).length!==0)return json(400,{error:"body_not_allowed"});
 const model=env.GEMINI_MODEL||"gemini-3.5-flash-lite";
 if(!env.GEMINI_API_KEY||!modelAllowlist.has(model))return json(503,{error:"provider_not_configured"});

 const input=syntheticInput();
 assertInput(input,authority);
 const egress=projectEgress(input,authority);
 const system="Return a JSON ModelCandidateV1 object with exactly these keys: schema_version, snapshot_fingerprint, finding_ids, options, requests. "
  +"Copy schema_version and snapshot_fingerprint exactly. Select findings ONLY from finding_ids. "
  +"There are no admitted intervention references or hints; options must be []. "
  +"Requests, if any, must have template_id, gap_id and hint_id:null. "
  +"Use known IDs only. No warnings, numerical values, explanations or extra keys.";
 const started=Date.now();
 let response:Response;
 try {
  response=await providerFetch(
   "https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",
   {method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
    signal:AbortSignal.timeout(8000),
    body:JSON.stringify({
     systemInstruction:{parts:[{text:system}]},
     contents:[{role:"user",parts:[{text:JSON.stringify(egress)}]}],
     generationConfig:{responseMimeType:"application/json",temperature:0,maxOutputTokens:512}
    })
   }
  );
 } catch {return json(502,{error:"provider_unavailable"});}
 if(!response.ok)return json(502,{error:"provider_rejected_request"});
 try {
  const wire=await response.json() as {
   candidates?:{content?:{parts?:{text?:string}[]}}[];
   usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number}
  };
  const raw=wire.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!raw||raw.length>8192)return json(502,{error:"provider_invalid_output"});
  const candidate:unknown=JSON.parse(raw);
  assertCandidate(candidate);
  const result=bindCandidate(input,authority,candidate,
   "synthetic_"+randomBytes(8).toString("hex"),
   new Date().toISOString(),egress.snapshot_fingerprint);
  assertOutput(result,input,authority);
  return json(200,{mode:"synthetic_only",model,latency_ms:Date.now()-started,
   usage:{prompt_tokens:wire.usageMetadata?.promptTokenCount??null,
    output_tokens:wire.usageMetadata?.candidatesTokenCount??null},
   result});
 } catch {
  return json(502,{error:"provider_invalid_output"});
 }
}
export default {fetch(request:Request){return handleSyntheticPreview(request);}};

// END_SYNTHETIC_ENDPOINT
