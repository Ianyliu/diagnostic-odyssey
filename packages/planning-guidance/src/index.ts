import {createHash} from "node:crypto";
import {assertInput,assertEgress,assertCandidate,contextKey} from "./guards.ts";
import {VERSION} from "./types.ts";
import type {PlanningGuidanceInputV1,ModelEgressV1,PlanningGuidanceOutputV1,VerifiedAuthority} from "./types.ts";
export {VERSION} from "./types.ts";
export {assertInput,assertEgress,assertCandidate,validate,contextKey} from "./guards.ts";
export type * from "./types.ts";
const sha=(s:string)=>createHash("sha256").update(s,"utf8").digest("hex");
function canonical(x:unknown):string {
 if(x===null)return "null";
 if(typeof x==="string"||typeof x==="boolean")return JSON.stringify(x);
 if(typeof x==="number"){if(!Number.isFinite(x))throw Error("non-finite canonical number");return JSON.stringify(Object.is(x,-0)?0:x)}
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 if(x&&typeof x==="object"){const o=x as Record<string,unknown>;return "{"+Object.keys(o).sort().map(k=>JSON.stringify(k)+":"+canonical(o[k])).join(",")+"}"}
 throw Error("unsupported canonical value");
}
export function canonicalJSON(x:unknown){return canonical(x)}
/** Locale-independent UTF-16 code-unit comparison for canonical IDs. */
export const compareIds=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const arrayKeys=["national_findings","selected_local_context","scenario_assumptions","deterministic_results","warnings","gaps","request_templates"];
export function snapshotContent(input:PlanningGuidanceInputV1,authority:VerifiedAuthority){
 assertInput(input,authority);
 const {captured_at:__excluded,...rest}=input;void __excluded;
 const copy=structuredClone(rest) as Record<string,any>;
 for(const k of arrayKeys)copy[k].sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 copy.narrative_admission.references.sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 copy.hint_admission.hints.sort((a:{id:string},b:{id:string})=>compareIds(a.id,b.id));
 for(const t of copy.request_templates)t.field_codes.sort(compareIds);
 return copy;
}
export function fingerprint(input:PlanningGuidanceInputV1,authority:VerifiedAuthority){
 return "pg1:"+sha("DiagnosticOdyssey/PlanningGuidanceSnapshot/v1\n"+canonical(snapshotContent(input,authority)));
}
export function projectEgress(input:PlanningGuidanceInputV1,authority:VerifiedAuthority):ModelEgressV1 {
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
const has=(a:{id:string}[],id:string)=>a.some(x=>x.id===id);
export function bindCandidate(input:PlanningGuidanceInputV1,authority:VerifiedAuthority,candidate:unknown,generationId:string,generatedAt:string,expectedFingerprint:string):PlanningGuidanceOutputV1{
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
  return {proposal_id:"pgp1:"+sha("request\n"+fp+"\n"+generationId+"\n"+t.id+"\n"+x.gap_id+"\n"+(x.hint_id??"none")+"\n"+(input.hint_admission.release_sha256??"none")),template:structuredClone(t),hint_id:x.hint_id,disposition:"pending" as const};
 });
 const result:PlanningGuidanceOutputV1={
 schema_version:VERSION,snapshot_fingerprint:fp,generation:{state:"available",id:generationId,at:generatedAt},
 sections:trustedSectionStates(input),
 supported_findings:input.national_findings.filter(x=>candidate.finding_ids.includes(x.id)).map(x=>structuredClone(x)),
 intervention_options:opts,draft_requests:reqs,warnings:input.warnings.map(x=>structuredClone(x)),
 boundary:"AI_assisted_draft_independently_verify"
 };assertOutput(result,input,authority);return result;
}
export function unavailable(input:PlanningGuidanceInputV1,authority:VerifiedAuthority,state:"unavailable"|"invalid"|"stale"="unavailable"):PlanningGuidanceOutputV1{
 const result:PlanningGuidanceOutputV1={schema_version:VERSION,snapshot_fingerprint:fingerprint(input,authority),generation:{state,id:null,at:null},sections:{findings:"unavailable",interventions:"unavailable",requests:"unavailable"},supported_findings:[],intervention_options:[],draft_requests:[],warnings:[],boundary:"no_model_execution"};
 assertOutput(result,input,authority);return result;
}
export function assertOutput(out:unknown,input:PlanningGuidanceInputV1,authority:VerifiedAuthority):asserts out is PlanningGuidanceOutputV1 {
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
  const expected="pgp1:"+sha("request\n"+x.snapshot_fingerprint+"\n"+g.id+"\n"+t.id+"\n"+t.gap_id+"\n"+(req.hint_id??"none")+"\n"+(input.hint_admission.release_sha256??"none"));
  if(req.proposal_id!==expected||proposalIds.has(expected))throw Error("invalid request binding");proposalIds.add(expected);
 }
 // Recompute availability from the independently verified input, not model selection.
 // Empty selected arrays are valid even when the trusted section is available.
 const expectedSections=trustedSectionStates(input);
 for(const section of ["findings","interventions","requests"] as const){
  if(s[section]!==expectedSections[section])throw Error("section state contradicts trusted evidence: "+section);
 }
}
