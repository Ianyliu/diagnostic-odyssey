import type {PlanningGuidanceInputV1,ModelCandidateV1,ModelEgressV1,VerifiedAuthority} from "./types.ts";
import {VERSION} from "./types.ts";
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
export function contextKey(c:PlanningGuidanceInputV1["context"]){return [c.condition_id,c.cohort_id,c.population_id,c.setting_id,c.payer_id,c.geography_id,c.pathway_step_id,c.mechanism_id].join("|")}
const empty:VerifiedAuthority={narrative:null,hints:null};
export function assertInput(x:unknown,authority:VerifiedAuthority=empty):asserts x is PlanningGuidanceInputV1{
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
export function assertEgress(x:unknown):asserts x is ModelEgressV1{
 const o=obj(x,"egress",["schema_version","snapshot_fingerprint","context","finding_ids","local_ids","assumption_ids","result_ids","warning_ids","gap_ids","template_ids","references","hint_ids"]);
 if(o.schema_version!==VERSION||typeof o.snapshot_fingerprint!=="string"||!FP.test(o.snapshot_fingerprint))bad("egress version/fingerprint");
 ctx(o.context,"context");
 for(const [k,max] of [["finding_ids",21],["local_ids",34],["assumption_ids",16],["result_ids",16],["warning_ids",32],["gap_ids",24],["template_ids",24],["hint_ids",32]] as const){const a=list(o[k],k,max,id);unique(a,x=>x as string,k)}
 const refs=list(o.references,"references",32,(x,p)=>scalar(x,p,["id","claim_code"]));unique(refs,x=>(x as any).id,"references");
}
export function assertCandidate(x:unknown):asserts x is ModelCandidateV1{
 const o=obj(x,"candidate",["schema_version","snapshot_fingerprint","finding_ids","options","requests"]);
 if(o.schema_version!==VERSION||typeof o.snapshot_fingerprint!=="string"||!FP.test(o.snapshot_fingerprint))bad("candidate version/fingerprint");
 for(const [k,max] of [["finding_ids",21]] as const){const a=list(o[k],k,max,id);unique(a,x=>x as string,k)}
 const opts=list(o.options,"options",32,(x,p)=>scalar(x,p,["reference_id","claim_code"]));unique(opts,x=>(x as any).reference_id,"options");
 const requests=list(o.requests,"requests",24,(x,p)=>{const q=obj(x,p,["template_id","gap_id","hint_id"]);id(q.template_id,p+".template_id");id(q.gap_id,p+".gap_id");if(q.hint_id!==null)id(q.hint_id,p+".hint_id")});unique(requests,x=>(x as any).template_id,"requests");
}
export function validate<T>(x:unknown,fn:(x:unknown)=>asserts x is T):{ok:true;value:T}|{ok:false;error:string}{try{fn(x);return {ok:true,value:x}}catch(e){return {ok:false,error:String(e)}}}
