import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {handleReviewedGuidance} from "../api/ai-guidance.ts";

const here=dirname(fileURLToPath(import.meta.url));
const token="operator-credential-that-is-long-enough-20261021";
const key="SENTINEL_GEMINI_API_KEY_NEVER_LEAK";
const env={VERCEL_ENV:"preview",AI_PREVIEW_ENABLED:"on",AI_GUIDANCE_ENABLED:"on",AI_PREVIEW_TOKEN:token,
 GEMINI_API_KEY:key,GEMINI_MODEL:"gemini-3.5-flash-lite"};
const national=JSON.parse(readFileSync(resolve(here,"../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json"),"utf8"));
const local=JSON.parse(readFileSync(resolve(here,"../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json"),"utf8"));
const selected=()=>({schema_version:"do.gemini-reviewed.v1",
 national_artifact_version:national.manifest.artifact_version,
 local_artifact_version:local.manifest.artifact_version,
 finding_ids:["meps24-gross-all-cause-spending-total","meps24-k6-score-mean"],
 local_ids:[local.indicators[3].indicator_id,"wv.acs.poverty_pct"],
 brief_generated_at:new Date().toISOString()});
const url="https://protected.example.vercel.app/api/ai-guidance";
function request(action:"prepare"|"analyze",selection:any,challenge:string|null=null,t=token) {
 return new Request(url,{method:"POST",headers:{"Authorization":"Bearer "+t,"Content-Type":"application/json","Origin":"https://protected.example.vercel.app"},
  body:JSON.stringify({action,selection,consent:true,challenge})});
}
const mock=(async(url:RequestInfo|URL,init?:RequestInit)=>{
 assert.equal(String(url).includes(key),false);
 assert.equal(new Headers(init?.headers).get("x-goog-api-key"),key);
 const wire=JSON.parse(String(init?.body)),egress=JSON.parse(wire.contents[0].parts[0].text);
 assert.equal("value" in egress,false);
 assert.equal("national_findings" in egress,false);
 assert.deepEqual(egress.references,[]);
 assert.deepEqual(egress.hint_ids,[]);
 return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
   schema_version:"pg.v1",snapshot_fingerprint:egress.snapshot_fingerprint,
   finding_ids:[egress.finding_ids[0]],options:[],
   requests:[{template_id:"draft_referral_timing",gap_id:"referral_measurement_gap",hint_id:null}]
 })}]}}],usageMetadata:{promptTokenCount:40,candidatesTokenCount:30}});
}) as typeof fetch;
async function prepare(selection=selected(),provider=mock){
 const resp=await handleReviewedGuidance(request("prepare",selection),env,provider);
 const body=await resp.text();
 assert.equal(resp.status,200,body);
 return (JSON.parse(body) as {challenge:string}).challenge;
}
test("reviewed source hashes and exact reviewed promotions are pinned",()=>{
 const map=[
  ["meps-2024-long-covid-candidate-20260926T011343Z/bundle.json","5b32bfb3288a28ce0a57de4d0c3ec75fe1d83c0f19ad481e687b70af4a91eca0"],
  ["local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json","82e3cc5d5c6bd1d084fddb47b36ca08df76be19ab2a641dbba50b8c59c467bc4"]
 ];
 for(const [name,expected] of map){
  const group=name.startsWith("meps")?"meps-2024-long-covid-candidate-20260926T011343Z":"local-context-wv-hrsa-acs-candidate-20260924T052332Z";
  const raw=readFileSync(resolve(here,"../../../artifacts/reviewed/"+name));
  assert.equal(createHash("sha256").update(raw).digest("hex"),expected,group+" bytes drift");
 }
 assert.equal(national.burden_domains.flatMap((d:any)=>d.measures).length,21);
 assert.equal(local.indicators.length,34);
});
test("strict Preview authentication, production isolation, disable flag and no provider calls",async()=>{
 let calls=0;const reject=(async()=>{calls++;throw Error("should not call");}) as typeof fetch;
 const s=selected();
 for(const [e,t,code] of [
  [{...env,VERCEL_ENV:"production"},token,404],
  [{...env,AI_GUIDANCE_ENABLED:"off"},token,404],
  [env,"incorrect",401],
  [{...env,AI_PREVIEW_ENABLED:"off"},token,404]
 ] as const)assert.equal((await handleReviewedGuidance(request("prepare",s,null,t),e,reject)).status,code);
 assert.equal((await handleReviewedGuidance(new Request(url,{method:"GET"}),env,reject)).status,401);
 assert.equal(calls,0);
});
test("real national and WV evidence is resolved by server, with model bound to IDs",async()=>{
 const s=selected(),challenge=await prepare(s);
 const response=await handleReviewedGuidance(request("analyze",s,challenge),env,mock);
 assert.equal(response.status,200);
 const body=await response.json() as any;
 assert.equal(body.mode,"reviewed_evidence_preview");
 assert.equal(body.result.sections.interventions,"insufficient_evidence");
 assert.deepEqual(body.result.intervention_options,[]);
 assert.equal(body.result.draft_requests[0].disposition,"pending");
 assert.equal(body.selected_evidence.local.length,2);
 assert.equal(body.selected_evidence.local[0].value,2);
 assert.equal(body.selected_evidence.national[0].value,97260052511.99054);
 assert.equal(body.result.supported_findings[0].value,97260052511.99054);
 assert.equal(body.result.warnings.length,10);
 // A signed challenge is consumed once per function instance; there is no replayed provider call.
 assert.equal((await handleReviewedGuidance(request("analyze",s,challenge),env,mock)).status,409);
 assert.equal(body.provenance.national_release_sha256,"5b32bfb3288a28ce0a57de4d0c3ec75fe1d83c0f19ad481e687b70af4a91eca0");
 assert.equal(JSON.stringify(body).includes(key),false);
 assert.equal(JSON.stringify(body).includes(token),false);
});
test("forged numbers, unknown IDs, mismatched versions and stale snapshots rejected",async()=>{
 const base=selected();
 for(const forged of [
  {...base,finding_ids:["forged-id"]},
  {...base,local_ids:["invented-wv-indicator"]},
  {...base,local_artifact_version:"attacker_release"},
  {...base,national_artifact_version:"legacy"},
  {...base,brief_generated_at:"2026-01-01T00:00:00Z"},
  {...base,numeric_override:99999999},
  {...base,finding_ids:[...base.finding_ids,base.finding_ids[0]]}
 ]){
  assert.equal((await handleReviewedGuidance(request("prepare",forged),env,mock)).status,422);
 }
 assert.equal((await handleReviewedGuidance(new Request(url,{method:"POST",headers:{Authorization:"Bearer "+token},body:"{not-json"}),env,mock)).status,400);
});
test("challenge bound to exact selections; expired, tampered and wrong origins fail",async()=>{
 const s=selected(),challenge=await prepare(s);
 const shifted={...s,finding_ids:[]};
 assert.equal((await handleReviewedGuidance(request("analyze",shifted,challenge),env,mock)).status,409);
 assert.equal((await handleReviewedGuidance(request("analyze",s,challenge.slice(0,-1)+"0"),env,mock)).status,409);
 const wrongOrigin=new Request(url,{method:"POST",headers:{"Authorization":"Bearer "+token,"Origin":"https://attacker.invalid"},body:JSON.stringify({action:"analyze",consent:true,selection:s,challenge})});
 assert.equal((await handleReviewedGuidance(wrongOrigin,env,mock)).status,403);
 const noConsent=new Request(url,{method:"POST",headers:{Authorization:"Bearer "+token},body:JSON.stringify({action:"prepare",consent:false,selection:s,challenge:null})});
 assert.equal((await handleReviewedGuidance(noConsent,env,mock)).status,422);
});
test("invalid provider candidates, rejected requests and secret leakage fail closed",async()=>{
 const s=selected(),challenge=await prepare(s);
 const forged=(async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const egress=JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({schema_version:"pg.v1",
   snapshot_fingerprint:egress.snapshot_fingerprint,finding_ids:["invented"],options:[],requests:[]})}]}}]});
 }) as typeof fetch;
 const result=await handleReviewedGuidance(request("analyze",s,challenge),env,forged);
 assert.equal(result.status,502);
 assert.deepEqual(await result.json(),{error:"provider_invalid_output"});
 const bad=(async()=>new Response(key+" "+token,{status:400})) as typeof fetch;
 const fail=await handleReviewedGuidance(request("analyze",s,challenge),env,bad);
 assert.equal(fail.status,502);
 assert.equal((await fail.text()).includes(key),false);
});
test("source-independent canonical inline code and deployment path",()=>{
 const entry=readFileSync(resolve(here,"../api/ai-guidance.ts"),"utf8");
 const cases=[
  {key:"TYPES",filename:"types.ts",normalize:(x:string)=>x.replace(/^export /gm,"")},
  {key:"GUARDS",filename:"guards.ts",normalize:(x:string)=>x.replace(/^import .*;\n/gm,"").replace(/^export /gm,"")},
  {key:"INDEX",filename:"index.ts",normalize:(x:string)=>x.replace(/^import .*;\n/gm,"").replace(/^export \{.*\} from .*;\n/gm,"").replace(/^export type \* from .*;\n/gm,"").replace(/^export /gm,"")}
 ];
 for(const item of cases){
  const src=readFileSync(resolve(here,"../../../packages/planning-guidance/src",item.filename),"utf8");
  const start="// BEGIN_CANONICAL_"+item.key+"\n",end="\n// END_CANONICAL_"+item.key;
  const i=entry.indexOf(start),j=entry.indexOf(end);
  assert.ok(i>=0&&j>i);
  assert.equal(entry.slice(i+start.length,j),item.normalize(src).trimEnd());
 }
 assert.deepEqual(entry.split("\n").filter(line=>line.startsWith("import ")),
  ['import {createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";']);
 assert.doesNotMatch(entry,/from ["'](?:\.|@diagnostic-odyssey\/)/);
});
