import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateDataRequest, type AnalysisContext } from "@diagnostic-odyssey/contracts";
import { acquisitionResolver, createAcquisitionResolver, createSensitivityDataRequest, requestFingerprint, sanitizeBaseDataRequest } from "../src/index.ts";
import { canonicalJson, sha256 } from "../src/sha256.ts";
import { context, scenario, fixture, digest, readInput } from "./fixture.ts";

const request = () => createSensitivityDataRequest(scenario, "capacity");
const resolver = () => {const f = fixture(); return createAcquisitionResolver(f.bytes, f.pins);};

test("SHA-256 UTF-8 and padding match node crypto, including retained exact JSON preimages", () => {
  for (const value of ["", "abc", "a".repeat(55), "b".repeat(56), "c".repeat(64), "x".repeat(1000000), "λ 🧭", readInput("mapping-candidates.json"), readInput("context-policy.candidate.json")]) assert.equal(sha256(value), digest(value));
  assert.equal(canonicalJson({b:2,a:[1,null]}), '{"a":[1,null],"b":2}');
  for (const value of [NaN, Infinity, undefined]) assert.throws(() => canonicalJson(value));
});

test("all retained source bytes and frozen B dependencies match their actual SHA-256 preimages", () => {
  const files: {path: string; sha256: string}[] = JSON.parse(readInput("retained-files.json"));
  for (const file of files) assert.equal(digest(readInput(file.path)), file.sha256, file.path);
  const sources = JSON.parse(readInput("source-index.json"));
  for (const source of sources.sources) assert.equal(digest(readInput(source.path.replace("acquisition/", ""))), source.sha256);
  const subject = JSON.parse(readInput("review-subject.json"));
  assert.equal(digest(readInput("mapping-candidates.json")), subject.mapping_candidates_sha256);
  assert.equal(digest(readInput("context-policy.candidate.json")), subject.context_policy_sha256);
  assert.equal(digest(readInput("source-index.json")), subject.source_index_sha256);
  assert.equal(digest(readInput("application-context.json")), subject.application_context_sha256);
  assert.equal(digest(readInput("review-subject.json")), "db919797d7e2dd42cd6c44e8154ccd434181bc3de27009931504124721efb436");
});

test("production has no admitted registry; both technically assessed candidates remain withheld", () => {
  for (const field of ["capacity", "alternative_window_months"] as const) {
    const base = createSensitivityDataRequest(scenario, field);
    const resolved = acquisitionResolver.attach(base, context, scenario);
    assert.equal(resolved.state, "awaiting_admission"); assert.equal(resolved.guidance, undefined); assert.deepEqual(resolved.request, base);
  }
  assert.equal(acquisitionResolver.resolve(createSensitivityDataRequest(scenario, "reach"), context, scenario).state, "not_offered");
});

test("synthetic admitted entries require explicit attachment, preserve exact wording and bind every field", () => {
  const current = resolver();
  for (const field of ["capacity", "alternative_window_months"] as const) {
    const base = createSensitivityDataRequest(scenario, field);
    assert.equal(current.resolve(base, context, scenario).state, "available_to_attach");
    const attached = current.attach(base, context, scenario);
    assert.equal(attached.state, "reviewed");
    assert.deepEqual(sanitizeBaseDataRequest(attached.request), base);
    assert.equal(attached.request.acquisition_hint!.request_fingerprint, requestFingerprint(base, context, scenario));
    assert.equal(attached.guidance!.wording, JSON.parse(readInput("mapping-candidates.json")).hints.find((h: any) => h.eligible_request_family === base.request_id).proposed_guidance_wording);
    assert.match(attached.guidance!.privacy_boundary, /Aggregate steward-approved/);
    assert.equal(current.resolve(attached.request, context, scenario).state, "reviewed");
    attached.guidance!.wording = "FORGED"; attached.guidance!.field_crosswalk[0]!.limits = "FORGED";
    assert.doesNotMatch(current.resolve(attached.request, context, scenario).guidance!.wording, /FORGED/);
    assert.doesNotMatch(current.resolve(attached.request, context, scenario).guidance!.field_crosswalk[0]!.limits, /FORGED/);
  }
});

test("legacy projection preserves absent/null optional base fields and ordered needed fields", () => {
  const base = request(); delete base.target_mechanism;
  assert.deepEqual(sanitizeBaseDataRequest(base), base);
  assert.equal(Object.hasOwn(sanitizeBaseDataRequest(base), "target_mechanism"), false);
  assert.deepEqual(sanitizeBaseDataRequest({...base, target_mechanism:null}), {...base, target_mechanism:null});
});

test("invalid optional metadata and forged snapshots are withheld without repairing a bad base", () => {
  const current = resolver();
  for (const metadata of [null, undefined, [], "hint", {}, {hint_id:"unknown"}, {...current.attach(request(),context,scenario).request.acquisition_hint, snapshot:{wording:"FORGED"}}]) {
    const raw = {...request(), acquisition_hint:metadata, acquisition_guidance:{wording:"FORGED"}, resolved_hint:{wording:"FORGED"}};
    assert.ok(validateDataRequest(raw).length > 0);
    const resolved = current.resolve(raw,context,scenario);
    assert.equal(resolved.state,"invalid_reference"); assert.deepEqual(resolved.request, request()); assert.equal(resolved.guidance,undefined);
    assert.throws(() => current.resolve({...raw, fields_needed:[42]},context,scenario), /Invalid base/);
  }
});

test("unknown IDs, unsupported versions, extra nested fields and malformed digests fail closed", () => {
  const current = resolver(); const attached = current.attach(request(),context,scenario).request;
  for (const [key,value] of [["hint_id","UNKNOWN"],["hint_version","3"],["schema_version","2"],["registry_sha256","bad"],["request_fingerprint","F".repeat(64)],["wording","FORGED"]]) {
    const raw = {...attached, acquisition_hint:{...attached.acquisition_hint,[key as string]:value}};
    const resolved=current.resolve(raw,context,scenario); assert.equal(resolved.state,"invalid_reference"); assert.equal(resolved.request.acquisition_hint,undefined);
  }
});

test("forged request bindings and changed scenario identities require explicit reattachment", () => {
  const current=resolver(); const attached=current.attach(request(),context,scenario).request;
  for(const key of ["request_fingerprint","registry_sha256","policy_sha256","source_index_sha256","review_sha256"] as const) {
    const raw={...attached,acquisition_hint:{...attached.acquisition_hint!,[key]:"a".repeat(64)}};
    assert.equal(current.resolve(raw,context,scenario).state,"stale_reference");
  }
  const changed={...scenario,scenario_id:"OTHER"};
  assert.equal(current.resolve(attached,context,changed).state,"stale_reference");
  assert.notEqual(requestFingerprint(request(),context,changed),requestFingerprint(request(),context,scenario));
  assert.equal(current.attach(attached,context,changed).state,"reviewed");
});

test("scenario changes, unknown/missing/extra context and other pathways never gain applicability", () => {
  const current=resolver(); const attached=current.attach(request(),context,scenario).request;
  for(const modified of [null,{...scenario,capacity:4},{...scenario,reach:NaN},{...scenario,target_pathway_step:"other"},{...scenario,mechanism:"other"}]) assert.equal(current.resolve(attached,context,modified).state,"not_applicable");
  for(const key of Object.keys(context)) {
    const missing={...context} as any; delete missing[key];
    assert.equal(current.resolve(attached,missing,scenario).state,"not_applicable");
    assert.equal(current.resolve(attached,{...context,[key]:"unknown"},scenario).state,"not_applicable");
  }
  assert.equal(current.resolve(attached,{...context,payer:"unknown"} as AnalysisContext,scenario).state,"not_applicable");
  assert.equal(current.resolve(attached,{...context,local_context_id:"selected-local-context"},scenario).state,"not_applicable");
});

test("all base field mutations affect identity or applicability; fingerprints ignore optional snapshots", () => {
  const base=request(); const original=requestFingerprint(base,context,scenario);
  for(const key of Object.keys(base)) {
    const changed={...base,[key]:key==="fields_needed"?[...base.fields_needed].reverse():`${(base as any)[key]} changed`};
    assert.notEqual(requestFingerprint(changed,context,scenario),original,key);
    assert.notEqual(resolver().resolve(changed,context,scenario).state,"reviewed");
  }
  assert.equal(requestFingerprint({...base,acquisition_guidance:"FORGED"},context,scenario),original);
});

test("registry/policy/review identity changes withhold previously resolved guidance", () => {
  const attached=resolver().attach(request(),context,scenario).request;
  for(const change of [(o:any)=>{o.registry.version="TEST-2";},(o:any)=>{o.policy.version="TEST-2";},(o:any)=>{o.review.reviewed_at="2000-01-02T00:00:00Z";}]) {
    const f=fixture(change); const next=createAcquisitionResolver(f.bytes,f.pins);
    assert.equal(next.resolve(attached,context,scenario).state,"stale_reference");
    assert.equal(next.attach(attached,context,scenario).state,"reviewed");
  }
});

test("tampered dependencies, nonallowlisted registry, missing reviews and unapproved entries cannot resolve", () => {
  for(const key of ["registry","mapping","policy","sourceIndex","review","applicationContext","artifact"] as const) {
    const f=fixture();f.bytes[key]+=" ";
    assert.equal(createAcquisitionResolver(f.bytes,f.pins).attach(request(),context,scenario).state,"artifact_unavailable",key);
  }
  const f=fixture();assert.equal(createAcquisitionResolver(f.bytes,[]).attach(request(),context,scenario).state,"artifact_unavailable");
  for(const change of [
    (o:any)=>{o.registry.release_status="candidate";},
    (o:any)=>{o.review.status="unsigned_AI_assessment";},
    (o:any)=>{o.review.reviewer="";},
    (o:any)=>{o.review.decisions[1].privacy="pending";},
    (o:any)=>{o.review.decisions[1].release="pending";},
    (o:any)=>{o.review.decisions.push(o.review.decisions[1]);},
    (o:any)=>{o.mapping.hints[1].official_support[0].elements[0].extra="forged";},
    (o:any)=>{o.mapping.hints[1].field_crosswalk.pop();},
    (o:any)=>{o.policy.proposed_rule.wildcard=true;},
    (o:any)=>{o.policy.proposed_rule.eligible_request_ids.push("session.sensitivity.reach");},
    (o:any)=>{o.sourceIndex.sources[0].sha256="a".repeat(64);}
  ]) {const mutated=fixture(change);assert.equal(createAcquisitionResolver(mutated.bytes,mutated.pins).attach(request(),context,scenario).state,"artifact_unavailable");}
});

test("a separately pinned release may admit only a reviewed subset", () => {
  const f=fixture(o=>{o.registry.approved_hint_ids=["ACQ26-CAPACITY-01@2"];o.review.decisions=o.review.decisions.filter((d:any)=>d.hint_id==="ACQ26-CAPACITY-01");});
  const current=createAcquisitionResolver(f.bytes,f.pins);
  assert.equal(current.attach(request(),context,scenario).state,"reviewed");
  assert.equal(current.attach(createSensitivityDataRequest(scenario,"alternative_window_months"),context,scenario).state,"awaiting_admission");
});

test("actual unsigned assessment and owner authorization are never release decisions", () => {
  const assessment=readFileSync(new URL("../../../docs/acquisition-hints-2026-10-11/B-acquisition-ai-assessment.json",import.meta.url),"utf8");
  const f=fixture();f.bytes.review=assessment;
  const registry=JSON.parse(f.bytes.registry);registry.review_sha256=digest(assessment);f.bytes.registry=JSON.stringify(registry);
  assert.equal(createAcquisitionResolver(f.bytes,[digest(f.bytes.registry)]).attach(request(),context,scenario).state,"artifact_unavailable");
});
