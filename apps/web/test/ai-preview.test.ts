import {test} from "node:test";
import assert from "node:assert/strict";
import {handleSyntheticPreview} from "../api/ai-preview.ts";

const token="abcdefghijklmnopqrstuvwxyz0123456789abcdefgh";
const key="SENTINEL_GEMINI_API_KEY";
const env={VERCEL_ENV:"preview",AI_PREVIEW_ENABLED:"on",AI_PREVIEW_TOKEN:token,
 GEMINI_API_KEY:key,GEMINI_MODEL:"gemini-3.5-flash-lite"};
const url="https://example.vercel.app/api/ai-preview";
const req=(t=token,body?:string)=>new Request(url,{method:"POST",
 headers:{"Authorization":"Bearer "+t},...(body?{body}:{})});

test("disabled and unauthenticated calls do not reach Gemini",async()=>{
 let count=0;
 const network=(async()=>{count++;throw Error("must not call");}) as typeof fetch;
 for(const [request,values,status] of [
  [req(),{...env,VERCEL_ENV:"production"},404],
  [req(),{...env,AI_PREVIEW_ENABLED:"off"},404],
  [req("incorrect"),env,401],
  [req(token,"untrusted-data"),env,400]
 ] as const){
  const result=await handleSyntheticPreview(request,values,network);
  assert.equal(result.status,status);
 }
 assert.equal(count,0);
});

test("valid synthetic candidate is bound to trusted input and preserves warnings",async()=>{
 let calls=0;
 const network=(async(url:RequestInfo|URL,init?:RequestInit)=>{
  calls++;
  assert.equal(String(url).includes(key),false);
  assert.equal(new Headers(init?.headers).get("x-goog-api-key"),key);
  const body=JSON.parse(String(init?.body));
  const egress=JSON.parse(body.contents[0].parts[0].text);
  assert.equal("value" in egress,false);
  assert.deepEqual(egress.references,[]);
  assert.deepEqual(egress.hint_ids,[]);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
   schema_version:"pg.v1",snapshot_fingerprint:egress.snapshot_fingerprint,
   finding_ids:["finding_synthetic_1"],options:[],
   requests:[{template_id:"template_synthetic_1",gap_id:"gap_synthetic_1",hint_id:null}]
  })}]}}],usageMetadata:{promptTokenCount:75,candidatesTokenCount:60}});
 }) as typeof fetch;
 const response=await handleSyntheticPreview(req(),env,network);
 assert.equal(response.status,200);
 const text=await response.text();
 assert.equal(text.includes(key),false);
 const output=JSON.parse(text);
 assert.equal(output.mode,"synthetic_only");
 assert.equal(output.result.supported_findings[0].value,10);
 assert.equal(output.result.sections.interventions,"insufficient_evidence");
 assert.equal(output.result.draft_requests[0].disposition,"pending");
 assert.deepEqual(output.result.warnings,[{id:"warning_synthetic_1",code:"synthetic_not_evidence"}]);
 assert.equal(calls,1);
});

test("hallucinated ID and provider failures fail closed without secrets",async()=>{
 const invalid=(async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const e=JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
   schema_version:"pg.v1",snapshot_fingerprint:e.snapshot_fingerprint,
   finding_ids:["nonexistent"],options:[],requests:[]
  })}]}}]});
 }) as typeof fetch;
 const forged=await handleSyntheticPreview(req(),env,invalid);
 assert.equal(forged.status,502);
 assert.deepEqual(await forged.json(),{error:"provider_invalid_output"});
 const reject=(async()=>new Response("secret: "+key,{status:401})) as typeof fetch;
 const denied=await handleSyntheticPreview(req(),env,reject);
 assert.equal(denied.status,502);
 assert.equal((await denied.text()).includes(key),false);
 const malformed=(async()=>Response.json({candidates:[{content:{parts:[{text:"{bad-json"}]}}]})) as typeof fetch;
 assert.equal((await handleSyntheticPreview(req(),env,malformed)).status,502);
});
