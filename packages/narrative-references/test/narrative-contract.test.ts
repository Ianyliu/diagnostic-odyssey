import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertValidNarrativeReference, assertValidNarrativeReferenceCatalog,
  validateNarrativeReference, validateNarrativeReferenceCatalog,
  type NarrativeReference, type NarrativeReferenceCatalog
} from "../src/index.ts";

const reference = (): NarrativeReference => ({
  claim_id: "SYN26-TEST-01",
  source: {
    source_id: "synthetic-source",
    citation: "Synthetic reference for contract tests only",
    title: "Synthetic test fixture — NOT scientific evidence",
    authors: ["Test Author"],
    publication_year: 2026,
    source_kind: "official_report",
    doi: null,
    pmcid: null,
    url: "https://example.invalid/fixture",
    locators: [{kind: "section", detail: "Synthetic Section 1"}],
    retrieved_at: null,
    source_sha256: null
  },
  proposed_claim_wording: "Synthetic candidate wording, not cleared for display.",
  approved_claim_wording: null,
  prohibited_stronger_claims: [],
  applicability: {
    population: "Synthetic adults",
    condition_definition: "Synthetic condition",
    setting: "Synthetic health system",
    payer: "Not reported",
    geography: "Synthetic region",
    pathway_step: "recognition-to-referral",
    mechanism: "navigation-support",
    applicability_limits: ["No external validity"]
  },
  causal_use_class: "observational_pathway_description",
  allowed_use: "background_context_only",
  limitations: ["Synthetic; no inference"],
  reviewer_status: "needs_review",
  review: {reviewer_id: null, reviewed_at: null, review_note: "Test only; no review"},
  release_status: "candidate",
  quantitative_effect_eligible: false
});
const catalog = (): NarrativeReferenceCatalog => ({
  manifest: {
    schema_version: "1.0",
    artifact_family: "narrative_intervention_references",
    catalog_id: "synthetic-contract-test",
    release_status: "candidate",
    generated_at: "2026-10-09T15:00:00Z",
    code_commit: "synthetic-test-only",
    review_manifest_sha256: null,
    automatic_release: false,
    quantitative_effect_eligible: false
  },
  records: [reference()]
});
const clone = <T>(value: T): T => structuredClone(value);
const paths = (value: unknown) => validateNarrativeReferenceCatalog(value).map(i => i.path);
const mutate = (f: (v: Record<string, unknown>) => void): string[] => {
  const v = clone(catalog()) as unknown as Record<string, unknown>;
  f(v);
  return paths(v);
};

test("synthetic candidate passes without claiming review or release", () => {
  const fixture = catalog();
  assert.deepEqual(validateNarrativeReferenceCatalog(fixture), []);
  assert.deepEqual(validateNarrativeReference(fixture.records[0]), []);
  assert.doesNotThrow(() => assertValidNarrativeReferenceCatalog(fixture));
  assert.doesNotThrow(() => assertValidNarrativeReference(fixture.records[0]));
});

test("every layer is a closed object; added effect/ROI/scenario fields are rejected", () => {
  const examples = [
    {container: "root", key: "evidence"},
    {container: "manifest", key: "automatic_quantitative_effect"},
    {container: "record", key: "effect_or_parameter"},
    {container: "record", key: "bounded_effect"},
    {container: "record", key: "scenario_parameter"},
    {container: "record", key: "value"},
    {container: "record", key: "confidence_interval"},
    {container: "record", key: "estimated_savings"},
    {container: "source", key: "effect_size"},
    {container: "source", key: "extra_metadata"},
    {container: "locator", key: "unreviewed_extra"},
    {container: "applicability", key: "quantitative_reach"},
    {container: "review", key: "quantitative_effect_eligible"}
  ] as const;
  for (const {container, key} of examples) {
    const v = clone(catalog()) as unknown as Record<string, unknown>;
    const m = v.manifest as Record<string, unknown>;
    const r = (v.records as Array<Record<string, unknown>>)[0]!;
    const containers: Record<typeof container, Record<string, unknown>> = {
      root: v, manifest: m, record: r,
      source: r.source as Record<string, unknown>,
      locator: ((r.source as Record<string, unknown>).locators as Array<Record<string, unknown>>)[0]!,
      applicability: r.applicability as Record<string, unknown>,
      review: r.review as Record<string, unknown>
    };
    containers[container][key] = 42;
    assert.ok(paths(v).some(p => p.endsWith("." + key)), container + "." + key);
    assert.throws(() => assertValidNarrativeReferenceCatalog(v), container + "." + key);
  }
});

test("both narrative-only structural invariants are required to remain false", () => {
  for (const key of ["quantitative_effect_eligible", "automatic_release"] as const) {
    assert.ok(mutate(v => {(v.manifest as Record<string, unknown>)[key] = true;})
      .some(p => p.endsWith("." + key)));
  }
  for (const val of [true, null, undefined, "false", 0]) {
    assert.ok(mutate(v => {
      ((v.records as Array<Record<string, unknown>>)[0]!)[
        "quantitative_effect_eligible"
      ] = val;
    }).some(p => p.endsWith(".quantitative_effect_eligible")));
  }
});

test("missing, malformed or incorrectly typed source provenance and applicability fail closed", () => {
  const cases: Array<[string, (r: Record<string, unknown>) => void]> = [
    ["source.url", r => {(r.source as Record<string, unknown>).url = "http://not-secure";}],
    ["source.authors", r => {(r.source as Record<string, unknown>).authors = []; }],
    ["source.locators", r => {(r.source as Record<string, unknown>).locators = []; }],
    ["source.locators[0].kind", r => {((r.source as Record<string, unknown>).locators as Array<Record<string, unknown>>)[0]!.kind = "unknown";}],
    ["source.pmcid", r => {(r.source as Record<string, unknown>).pmcid = "123";}],
    ["source.doi", r => {(r.source as Record<string, unknown>).doi = "not-doi";}],
    ["source.source_sha256", r => {(r.source as Record<string, unknown>).source_sha256 = "BAD";}],
    ["source.retrieved_at", r => {(r.source as Record<string, unknown>).retrieved_at = "2026-02-30T00:00:00Z";}],
    ["claim_id", r => {r.claim_id = "free-form";}],
    ["causal_use_class", r => {r.causal_use_class = "randomized_effect";}],
    ["allowed_use", r => {r.allowed_use = "scenario_parameter";}],
    ["applicability.mechanism", r => {(r.applicability as Record<string, unknown>).mechanism = ""; }],
    ["review.reviewed_at", r => {(r.review as Record<string, unknown>).reviewed_at = "yesterday";}],
    ["source.title", r => {delete (r.source as Record<string, unknown>).title;}]
  ];
  for (const [expected, edit] of cases) {
    const v = clone(catalog()) as unknown as {records: Array<Record<string, unknown>>};
    edit(v.records[0]!);
    assert.ok(paths(v).some(p => p.endsWith(expected)), expected);
  }
});

test("a claim cannot be approved without reviewer approval", () => {
  const v = clone(catalog());
  v.records[0]!.approved_claim_wording = "This should not pass as approved.";
  assert.ok(paths(v).some(p => p.endsWith("approved_claim_wording")));
});

test("release needs explicit review, source byte digest and immutable review manifest", () => {
  const v = clone(catalog());
  v.manifest.release_status = "reviewed_released";
  v.records[0]!.release_status = "reviewed_released";
  const violations = paths(v);
  for (const expected of [
    "review_manifest_sha256", "code_commit", "reviewer_status",
    "approved_claim_wording", "source_sha256", "retrieved_at",
    "reviewer_id", "reviewed_at", "prohibited_stronger_claims"
  ]) assert.ok(violations.some(p => p.endsWith(expected)), expected);

  v.manifest.review_manifest_sha256 = "a".repeat(64);
  v.manifest.code_commit = "b".repeat(40);
  const r = v.records[0]!;
  r.reviewer_status = "approved";
  r.approved_claim_wording = "Synthetic reviewer-approved text (test only).";
  r.prohibited_stronger_claims = ["Must not infer a measured effect."];
  r.source.source_sha256 = "c".repeat(64);
  r.source.retrieved_at = "2026-10-09T15:00:00Z";
  r.review.reviewer_id = "synthetic-reviewer";
  r.review.reviewed_at = "2026-10-09T15:01:00Z";
  assert.deepEqual(validateNarrativeReferenceCatalog(v), []);
});

test("candidate manifest never contains released records or review manifest digest", () => {
  const v = clone(catalog());
  v.records[0]!.release_status = "reviewed_released";
  assert.ok(paths(v).some(p => p.endsWith("release_status")));
  v.records[0]!.release_status = "candidate";
  v.manifest.review_manifest_sha256 = "a".repeat(64);
  assert.ok(paths(v).some(p => p.endsWith("review_manifest_sha256")));
});

test("catalog release cannot be empty, mixed or contain duplicate claim IDs", () => {
  const v = clone(catalog());
  v.records.push(clone(reference()));
  assert.ok(paths(v).some(p => p.endsWith("claim_id")));
  v.records[1]!.claim_id = "SYN26-TEST-02";
  assert.deepEqual(paths(v), []);

  v.records[1]!.source.title = "Conflicting title";
  assert.ok(paths(v).some(p => p.endsWith("source.source_id")));
  v.records[1]!.source.title = v.records[0]!.source.title;
  v.records[1]!.source.locators = [{kind: "page", detail: "p. 2"}];
  assert.deepEqual(paths(v), [], "distinct locators for same cited source are permitted");

  v.manifest.release_status = "reviewed_released";
  assert.ok(paths(v).some(p => p.endsWith("records[0].release_status")));
  v.records = [];
  assert.ok(paths(v).some(p => p.endsWith(".records")));
});

test("rejected claim cannot be presented as approved or released", () => {
  const v = clone(catalog());
  v.records[0]!.reviewer_status = "rejected";
  assert.ok(paths(v).some(p => p.endsWith("release_status")));
  v.records[0]!.release_status = "rejected";
  assert.deepEqual(paths(v), []);
  v.records[0]!.approved_claim_wording = "Do not present this.";
  assert.ok(paths(v).some(p => p.endsWith("approved_claim_wording") || p.endsWith("release_status")));
});

test("JSON Schema is closed on every object and structurally prohibits numeric effects", () => {
  const schema = JSON.parse(readFileSync(new URL(
    "../schema/narrative-intervention-references.v1.schema.json", import.meta.url
  ), "utf8")) as Record<string, unknown>;
  const defs = schema.$defs as Record<string, Record<string, unknown>>;
  for (const [name, node] of Object.entries({root: schema, ...defs})) {
    assert.equal(node.type, "object", name);
    assert.equal(node.additionalProperties, false, name);
    assert.deepEqual(node.required, Object.keys(node.properties as Record<string, unknown>), name);
  }
  assert.deepEqual((defs.record!.properties as Record<string, unknown>).quantitative_effect_eligible, {const: false});
  assert.deepEqual((defs.manifest!.properties as Record<string, unknown>).automatic_release, {const: false});
  assert.deepEqual((defs.manifest!.properties as Record<string, unknown>).quantitative_effect_eligible, {const: false});
  for (const name of ["effect_or_parameter", "bounded_effect", "value", "scenario_parameter"]) {
    assert.equal(Object.hasOwn(defs.record!.properties as object, name), false);
  }
});

test("package is not an import into existing quantitative evidence, brief, web or scenario code", () => {
  const files = [
    "../../../packages/contracts/src/index.ts",
    "../../../packages/evidence-core/src/index.ts",
    "../../../packages/scenario-engine/src/index.ts",
    "../../../packages/brief-core/src/index.ts",
    "../../../apps/web/src/data/reviewedArtifact.ts"
  ];
  for (const file of files) {
    const content = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(content.includes("@diagnostic-odyssey/narrative-references"), false, file);
  }
});
