import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import {assertInput, assertCandidate, assertOutput, bindCandidate, projectEgress} from "../../../packages/planning-guidance/src/index.ts";
import type {PlanningGuidanceInputV1, VerifiedAuthority} from "../../../packages/planning-guidance/src/types.ts";

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
