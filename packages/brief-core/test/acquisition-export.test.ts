import assert from "node:assert/strict";
import test from "node:test";
import { createAcquisitionResolver, createSensitivityDataRequest, sanitizeBaseDataRequest } from "@diagnostic-odyssey/acquisition-hints";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { fixture,context,scenario } from "../../acquisition-hints/test/fixture.ts";
import { buildPlanningBrief,serializeBriefJson,createBriefCodec,acquisitionWithheldWarning,type PlanningBrief } from "../src/index.ts";

const base=()=>createSensitivityDataRequest(scenario,"capacity");
const input=(requests:any[]=[])=>({context,estimates:[],localContext:[],scenario:{input:scenario,result:calculateScenario(scenario)},evidence:[],dataRequests:requests,generatedAt:"2000-01-01T00:00:00Z"});
function admitted() {const f=fixture();const resolver=createAcquisitionResolver(f.bytes,f.pins);return {resolver,codec:createBriefCodec(resolver)};}

test("legacy direct-core construction and actual JSON preserve previous shape without guidance",()=>{
  const request=base();const brief=buildPlanningBrief(input([request]));
  assert.deepEqual(brief.data_requests,[request]);assert.equal(Object.hasOwn(brief,"acquisition_guidance"),false);
  assert.deepEqual(JSON.parse(serializeBriefJson(brief)),brief);
});
test("constructor and serializer reconstruct exact canonical companion guidance for synthetic admitted requests",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  const raw={...attached,acquisition_guidance:{wording:"FORGED REQUEST SNAPSHOT"},resolved_hint:"FORGED"};
  const brief=codec.buildPlanningBrief(input([raw]));
  assert.deepEqual(brief.data_requests,[attached]);assert.equal(brief.acquisition_guidance!.length,1);
  brief.acquisition_guidance![0]!.wording="FORGED COMPANION SNAPSHOT";
  brief.acquisition_guidance![0]!.reference.request_fingerprint="f".repeat(64);
  const json=codec.serializeBriefJson(brief);assert.doesNotMatch(json,/FORGED/);
  const parsed=JSON.parse(json);assert.equal(parsed.acquisition_guidance[0].wording,resolver.resolve(attached,context,scenario).guidance!.wording);
  assert.deepEqual(parsed.acquisition_guidance[0].reference,parsed.data_requests[0].acquisition_hint);
});
test("direct serializer drops a forged top-level companion with absent, mismatched or malformed references",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  for(const request of [base(),{...attached,acquisition_hint:null},{...attached,acquisition_hint:{...attached.acquisition_hint,hint_id:"UNKNOWN"}},{...attached,acquisition_hint:{...attached.acquisition_hint,request_fingerprint:"a".repeat(64)}}]) {
    const brief={...buildPlanningBrief(input()),data_requests:[request],acquisition_guidance:[{wording:"FORGED"}]} as unknown as PlanningBrief;
    const parsed=JSON.parse(codec.serializeBriefJson(brief));
    assert.equal(parsed.acquisition_guidance,undefined);assert.deepEqual(parsed.data_requests,[base()]);assert.doesNotMatch(JSON.stringify(parsed),/FORGED/);
  }
});
test("default production constructors and serializers withhold even structurally valid synthetic references",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  const constructed=buildPlanningBrief(input([attached]));assert.deepEqual(constructed.data_requests,[base()]);assert.equal(constructed.acquisition_guidance,undefined);
  assert.ok(constructed.warnings.includes(acquisitionWithheldWarning));
  const reviewed=codec.buildPlanningBrief(input([attached]));const parsed=JSON.parse(serializeBriefJson(reviewed));
  assert.deepEqual(parsed.data_requests,[base()]);assert.equal(parsed.acquisition_guidance,undefined);assert.ok(parsed.warnings.includes(acquisitionWithheldWarning));
});
test("malformed hint metadata never rescues an invalid base request in construction or direct serialization",()=>{
  const raw={...base(),fields_needed:[42],acquisition_hint:null};
  assert.throws(()=>buildPlanningBrief(input([raw])),/Invalid base DataRequest/);
  const brief={...buildPlanningBrief(input()),data_requests:[raw]} as unknown as PlanningBrief;
  assert.throws(()=>serializeBriefJson(brief),/Invalid base DataRequest/);
});
test("changed canonical registry or policy invalidates a previously constructed export",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  const brief=codec.buildPlanningBrief(input([attached]));
  for(const change of [(o:any)=>{o.registry.version="TEST-2";},(o:any)=>{o.policy.version="TEST-2";},(o:any)=>{o.review.reviewed_at="2000-01-02T00:00:00Z";}]) {
    const f=fixture(change);const next=createBriefCodec(createAcquisitionResolver(f.bytes,f.pins));const parsed=JSON.parse(next.serializeBriefJson(brief));
    assert.equal(parsed.acquisition_guidance,undefined);assert.deepEqual(parsed.data_requests,[base()]);assert.ok(parsed.warnings.includes(acquisitionWithheldWarning));
  }
});
test("direct-core scenario staleness excludes requests and guidance; explicit refresh does not select anything",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  const changed={...scenario,capacity:1500};const changedInput={...input([attached]),scenario:{input:changed,result:calculateScenario(changed)}};
  const brief=codec.buildPlanningBrief(changedInput);assert.deepEqual(brief.data_requests,[]);assert.equal(brief.acquisition_guidance,undefined);
  const old=codec.buildPlanningBrief(input([attached]));old.scenario=changedInput.scenario;
  assert.deepEqual(JSON.parse(codec.serializeBriefJson(old)).data_requests,[]);
  const fresh=createSensitivityDataRequest(changed,"capacity");
  assert.equal(codec.buildPlanningBrief({...changedInput,dataRequests:[]}).data_requests.length,0);
  assert.deepEqual(codec.buildPlanningBrief({...changedInput,dataRequests:[fresh]}).data_requests,[fresh]);
});
test("mixed selected-current requests retain base-only reach and reviewed capacity; a wrong context withholds only guidance",()=>{
  const {resolver,codec}=admitted();const attached=resolver.attach(base(),context,scenario).request;
  const reach=createSensitivityDataRequest(scenario,"reach");
  const brief=codec.buildPlanningBrief(input([reach,attached]));assert.equal(brief.data_requests.length,2);assert.equal(brief.acquisition_guidance!.length,1);
  const different={...brief,context:{...context,local_context_id:"selected-local-context"}};
  const parsed=JSON.parse(codec.serializeBriefJson(different));assert.deepEqual(parsed.data_requests,[reach,sanitizeBaseDataRequest(attached)]);assert.equal(parsed.acquisition_guidance,undefined);
  assert.deepEqual(brief.evidence,[]);assert.deepEqual(brief.scenario!.result,calculateScenario(scenario));
});

test("adopted aggregate-only candidate wording survives canonical Brief JSON; no individual record release",()=>{
  const {resolver,codec}=admitted();
  const attached=["capacity","alternative_window_months"].map(field=>
    resolver.attach(createSensitivityDataRequest(scenario,field as "capacity" | "alternative_window_months"),context,scenario).request);
  const brief=codec.buildPlanningBrief(input(attached));
  assert.equal(brief.data_requests.length,2);
  const parsed=JSON.parse(codec.serializeBriefJson(brief));
  assert.equal(parsed.acquisition_guidance.length,2);
  const expectedPolicy="5531c472aa795f4c1a4058d35ccf5541ab21832c687f43062b971f0331fb6742";
  for(const g of parsed.acquisition_guidance) {
    assert.equal(g.reference.policy_sha256,expectedPolicy);
    assert.match(g.privacy_boundary,/Aggregate steward-approved summaries and counts only/);
    const effective=[g.wording,g.minimum_necessary_output,g.local_only_preparation,...g.privacy_limits].join(" ");
    assert.doesNotMatch(effective,/aggregate or de-identified|aggregate\\/de-identified outputs only/i);
    assert.match(effective,/aggregate/i);
    assert.deepEqual(g.reference,parsed.data_requests.find((r:any)=>r.request_id===g.request_id).acquisition_hint);
  }
  const timing=parsed.acquisition_guidance.find((g:any)=>g.request_id==="session.sensitivity.alternative_window_months");
  assert.match(timing.wording,/locally approved aggregate interval distributions and episode counts/);
  assert.match(timing.wording,/do not transfer record-level outputs/);
  assert.match(timing.wording,/differencing risk/);
  const withForged=structuredClone(brief);
  withForged.acquisition_guidance[0].wording="UPLOAD RAW IDENTIFIERS";
  withForged.acquisition_guidance[1].minimum_necessary_output="TRANSFER EMPLOYEE RECORDS";
  const safe=codec.serializeBriefJson(withForged);
  assert.doesNotMatch(safe,/UPLOAD RAW|TRANSFER EMPLOYEE/);
  assert.ok(safe.includes("Aggregate steward-approved"));
  assert.equal(JSON.parse(serializeBriefJson(brief)).acquisition_guidance,undefined);
});
