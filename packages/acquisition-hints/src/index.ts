import {
  validateDataRequest, validateAcquisitionHintReference, validateScenario, validateArtifactBundle,
  type AcquisitionHintReference, type AnalysisContext, type DataRequest, type Scenario
} from "@diagnostic-odyssey/contracts";
import { createSensitivityDataRequest, isDataRequestCurrentForScenario, sensitivityFieldFromDataRequestId } from "./dataRequestTemplates.ts";
import { canonicalJson, sha256 } from "./sha256.ts";
import type { AcquisitionGuidance, AcquisitionMapping, AcquisitionReleaseBytes, AcquisitionResolution, AcquisitionResolver } from "./types.ts";
export * from "./types.ts";
export * from "./dataRequestTemplates.ts";

export const aggregatePrivacyBoundary: AcquisitionGuidance["privacy_boundary"] = "Aggregate steward-approved summaries and counts only. No individual-level intervals, raw dates, identifiers, patient or employee records enter this app.";
const ids = ["ACQ26-TIMING-01", "ACQ26-CAPACITY-01"] as const;
const family = {"ACQ26-TIMING-01": "session.sensitivity.alternative_window_months", "ACQ26-CAPACITY-01": "session.sensitivity.capacity"};
const hashPattern = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(text);
function closed(value: unknown, keys: string[]): asserts value is Record<string, any> {
  if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error("Invalid closed release object");
}
const equal = (a: unknown, b: unknown) => {
  try { return canonicalJson(a) === canonicalJson(b); } catch { return false; }
};

/** Projection drops snapshots and unknown metadata, but never repairs an invalid base request. */
export function sanitizeBaseDataRequest(value: unknown): DataRequest {
  if (!record(value)) throw new Error("Invalid base DataRequest: expected object");
  const base: Record<string, unknown> = {};
  for (const key of ["request_id", "target_question", "pathway_step", "fields_needed", "likely_source_owner", "granularity_time_window", "rationale", "feasibility_privacy_notes"]) base[key] = value[key];
  if (Object.hasOwn(value, "target_mechanism")) base.target_mechanism = value.target_mechanism;
  const issues = validateDataRequest(base);
  if (issues.length) throw new Error(`Invalid base DataRequest: ${issues.map(issue => issue.path).join(", ")}`);
  return {...base, fields_needed: [...base.fields_needed as string[]]} as unknown as DataRequest;
}

export function requestFingerprint(request: unknown, context: AnalysisContext, scenario: Scenario): string {
  // All scenario fields (including identity/assumption refs) and exact context are bound.
  return sha256(canonicalJson({request: sanitizeBaseDataRequest(request), context, scenario}));
}

function validateMapping(value: unknown): asserts value is AcquisitionMapping {
  closed(value, ["candidate_hint_id", "candidate_version", "eligible_request_family", "source_owner_system", "required_information", "minimum_necessary_output", "local_only_preparation", "official_support", "mapping_limits", "local_confirmation", "review_status", "review_provenance", "existing_requested_fields", "field_crosswalk", "preparation_recommendation", "proposed_guidance_wording", "privacy_limits"]);
  if (!ids.includes(value.candidate_hint_id) || value.candidate_version !== "2" || value.eligible_request_family !== family[value.candidate_hint_id as keyof typeof family]) throw new Error("Unknown mapping family/version");
  for (const key of ["source_owner_system", "minimum_necessary_output", "local_only_preparation", "proposed_guidance_wording", "preparation_recommendation", "review_status"]) if (!text(value[key])) throw new Error("Missing mapping text");
  for (const key of ["required_information", "mapping_limits", "local_confirmation", "existing_requested_fields", "privacy_limits"]) if (!texts(value[key])) throw new Error("Missing mapping limits/information");
  if (!Array.isArray(value.official_support) || !value.official_support.length || !Array.isArray(value.field_crosswalk) || !value.field_crosswalk.length) throw new Error("Missing supporting locators");
  for (const source of value.official_support) {
    closed(source, ["version", "url", "source_path", "source_sha256", "retrieved_at", "publication_note", "elements"]);
    if (source.version !== "FHIR R4 4.0.1" || !/^https:\/\/hl7.org\/fhir\/R4\/[a-z]+-definitions.html$/.test(source.url) || !hashPattern.test(source.source_sha256) || !text(source.source_path) || !text(source.publication_note) || !Number.isFinite(Date.parse(source.retrieved_at)) || !Array.isArray(source.elements) || !source.elements.length) throw new Error("Invalid versioned source");
    for (const element of source.elements) {
      closed(element, ["element", "official_locator"]);
      if (!text(element.element) || element.official_locator !== `${source.url}#${element.element}`) throw new Error("Invalid precise element locator");
    }
  }
  for (const row of value.field_crosswalk) {
    closed(row, ["existing_field", "possible_spec_elements", "limits"]);
    if (!text(row.existing_field) || !(row.possible_spec_elements === null || text(row.possible_spec_elements)) || !text(row.limits)) throw new Error("Invalid crosswalk");
  }
  if (!equal(value.field_crosswalk.map((row: AcquisitionMapping["field_crosswalk"][number]) => row.existing_field), value.existing_requested_fields)) throw new Error("Incomplete crosswalk");
}

/**
 * Composition-root API: pins are independently authorized code/release configuration,
 * never request, Brief, URL, local-storage or caller-supplied companion metadata.
 * Integrity checks do not authenticate a reviewer. Production has no allowed release.
 */
export function createAcquisitionResolver(bytes: AcquisitionReleaseBytes | null, allowedRegistryDigests: readonly string[]): AcquisitionResolver {
  let admitted: {
    registry: Record<string, any>; policy: Record<string, any>; review: Record<string, any>;
    hints: AcquisitionMapping[]; registryHash: string;
  } | null = null;
  let invalidRelease = false;
  if (bytes !== null) {
    try {
      const registryHash = sha256(bytes.registry);
      if (!allowedRegistryDigests.includes(registryHash)) throw new Error("Registry is not independently allowlisted");
      const registry: unknown = JSON.parse(bytes.registry);
      closed(registry, ["schema_version", "registry_id", "version", "release_status", "mapping_sha256", "policy_sha256", "source_index_sha256", "review_sha256", "approved_hint_ids"]);
      if (registry.schema_version !== "1" || registry.release_status !== "reviewed_released" || !text(registry.registry_id) || !text(registry.version) || !texts(registry.approved_hint_ids) || new Set(registry.approved_hint_ids).size !== registry.approved_hint_ids.length || registry.approved_hint_ids.some((id: string) => !ids.some(known => `${known}@2` === id))) throw new Error("Unreleased or unknown registry entries");
      for (const [key, preimage] of [["mapping_sha256", bytes.mapping], ["policy_sha256", bytes.policy], ["source_index_sha256", bytes.sourceIndex], ["review_sha256", bytes.review]] as const) {
        if (registry[key] !== sha256(preimage)) throw new Error("Release dependency mismatch");
      }
      const mapping = JSON.parse(bytes.mapping);
      const policy = JSON.parse(bytes.policy);
      const sourceIndex = JSON.parse(bytes.sourceIndex);
      const review = JSON.parse(bytes.review);
      closed(mapping, ["candidate_registry_id", "version", "status", "prepared_at", "code_commit", "released", "approved_hint_ids", "hints", "omissions"]);
      if (!Array.isArray(mapping.hints) || mapping.hints.length !== 2) throw new Error("Only two frozen families supported");
      mapping.hints.forEach(validateMapping);
      if (new Set(mapping.hints.map((hint: AcquisitionMapping) => hint.candidate_hint_id)).size !== 2) throw new Error("Duplicate mapping");
      closed(policy, ["candidate_policy_id", "version", "status", "mapping_candidates_sha256", "source_index_sha256", "application_context_sha256", "approved_decisions", "proposed_rule", "currentness", "release_chain", "gate_requirement"]);
      if (policy.mapping_candidates_sha256 !== registry.mapping_sha256 || policy.source_index_sha256 !== registry.source_index_sha256) throw new Error("Policy dependency mismatch");
      closed(policy.proposed_rule, ["artifact_context_exact", "pathway_step", "target_mechanism", "eligible_request_ids", "required_checks", "allowed_use", "unknown_payer_setting", "other_contexts"]);
      closed(policy.proposed_rule.artifact_context_exact, ["condition_id", "cohort_id", "age_range", "evidence_year", "geography_scope", "local_context_id", "severity_filter", "artifact_version"]);
      if (policy.proposed_rule.pathway_step !== "recognition-to-referral" || policy.proposed_rule.target_mechanism !== "navigation-support" || !equal(policy.proposed_rule.eligible_request_ids, [family[ids[0]], family[ids[1]]])) throw new Error("Unknown context policy");
      if (sha256(bytes.applicationContext) !== policy.application_context_sha256) throw new Error("Application context preimage mismatch");
      const applicationContext = JSON.parse(bytes.applicationContext);
      const artifact = JSON.parse(bytes.artifact);
      if (sha256(bytes.artifact) !== applicationContext.artifact_sha256 || validateArtifactBundle(artifact).length || !equal(artifact.context, policy.proposed_rule.artifact_context_exact) || !equal(applicationContext.artifact_context, artifact.context)) throw new Error("Invalid or mismatched immutable artifact");
      closed(sourceIndex, ["status", "sources"]);
      if (!Array.isArray(sourceIndex.sources) || sourceIndex.sources.length !== 6) throw new Error("Missing source index");
      for (const source of sourceIndex.sources) {
        closed(source, ["path", "requested_url", "final_url", "retrieved_at", "bytes", "sha256", "last_modified"]);
        if (!hashPattern.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes <= 0) throw new Error("Invalid retained source identity");
      }
      for (const hint of mapping.hints as AcquisitionMapping[]) {
        for (const support of hint.official_support) {
          const source = sourceIndex.sources.filter((s: any) => s.path === `acquisition/${support.source_path}`);
          if (source.length !== 1 || source[0].sha256 !== support.source_sha256 || source[0].final_url !== support.url || source[0].retrieved_at !== support.retrieved_at) throw new Error("Source identity mismatch");
        }
      }
      closed(review, ["schema_version", "status", "reviewer", "reviewed_at", "evidence_url", "code_commit", "mapping_sha256", "policy_sha256", "source_index_sha256", "decisions"]);
      if (review.schema_version !== "1" || review.status !== "approved_for_release" || !text(review.reviewer) || !Number.isFinite(Date.parse(review.reviewed_at)) || !/^https:\/\//.test(review.evidence_url) || !/^[a-f0-9]{40}$/.test(review.code_commit) || !Array.isArray(review.decisions)) throw new Error("Missing genuine independent release decision");
      for (const key of ["mapping_sha256", "policy_sha256", "source_index_sha256"]) if (review[key] !== registry[key]) throw new Error("Review subject mismatch");
      for (const decision of review.decisions) {
        closed(decision, ["hint_id", "version", "mapping", "privacy", "context", "release"]);
        if (!ids.includes(decision.hint_id) || decision.version !== "2") throw new Error("Unknown review decision");
      }
      for (const identity of registry.approved_hint_ids as string[]) {
        const decisions = review.decisions.filter((d: any) => `${d.hint_id}@${d.version}` === identity);
        if (decisions.length !== 1 || decisions[0].mapping !== "approved" || decisions[0].privacy !== "aggregate_only" || decisions[0].context !== "approved" || decisions[0].release !== "approved") throw new Error("Unapproved mapping/privacy/context/release");
      }
      admitted = {registry, policy, review, hints: mapping.hints, registryHash};
    } catch { invalidRelease = true; }
  }

  const run = (value: unknown, context: AnalysisContext, scenario: Scenario | null, attaching: boolean): AcquisitionResolution => {
    const request = sanitizeBaseDataRequest(value);
    const raw = value as Record<string, unknown>;
    const hasReference = Object.hasOwn(raw, "acquisition_hint");
    const field = sensitivityFieldFromDataRequestId(request.request_id);
    if (!attaching && hasReference && validateAcquisitionHintReference(raw.acquisition_hint).length) return {request, state: "invalid_reference"};
    if (field !== "capacity" && field !== "alternative_window_months") return {request, state: hasReference ? "not_applicable" : "not_offered"};
    if (!scenario || validateScenario(scenario).length || !isDataRequestCurrentForScenario(request, scenario)) return {request, state: "not_applicable"};
    if (invalidRelease) return {request, state: "artifact_unavailable"};
    if (!admitted) return {request, state: "awaiting_admission"};
    const {registry, policy, review, registryHash, hints} = admitted;
    if (!equal(context, policy.proposed_rule.artifact_context_exact) || scenario.target_pathway_step !== policy.proposed_rule.pathway_step || scenario.mechanism !== policy.proposed_rule.target_mechanism) return {request, state: "not_applicable"};
    const hint = hints.find(h => h.eligible_request_family === request.request_id);
    if (!hint || !registry.approved_hint_ids.includes(`${hint.candidate_hint_id}@2`)) return {request, state: "awaiting_admission"};
    if (!equal(request.fields_needed, hint.existing_requested_fields) || !equal(request, sanitizeBaseDataRequest(createSensitivityDataRequest(scenario, field)))) return {request, state: "not_applicable"};
    let fingerprint: string;
    try { fingerprint = requestFingerprint(request, context, scenario); }
    catch { return {request, state: "not_applicable"}; }
    const reference: AcquisitionHintReference = {
      schema_version: "1", hint_id: hint.candidate_hint_id, hint_version: "2", registry_sha256: registryHash,
      policy_sha256: registry.policy_sha256, source_index_sha256: registry.source_index_sha256,
      review_sha256: registry.review_sha256, request_fingerprint: fingerprint
    };
    if (!attaching && !hasReference) return {request, state: "available_to_attach"};
    if (!attaching && !equal(raw.acquisition_hint, reference)) return {request, state: "stale_reference"};
    const guidance: AcquisitionGuidance = {
      request_id: request.request_id, reference, wording: hint.proposed_guidance_wording,
      source_owner_system: hint.source_owner_system, required_information: hint.required_information,
      minimum_necessary_output: hint.minimum_necessary_output, local_only_preparation: hint.local_only_preparation,
      official_support: hint.official_support, field_crosswalk: hint.field_crosswalk, mapping_limits: hint.mapping_limits,
      local_confirmation: hint.local_confirmation, privacy_limits: hint.privacy_limits, privacy_boundary: aggregatePrivacyBoundary,
      review: {reviewer: review.reviewer, reviewed_at: review.reviewed_at, evidence_url: review.evidence_url, code_commit: review.code_commit},
      registry_id: registry.registry_id, registry_version: registry.version
    };
    // Return independent copies: consumer mutations cannot corrupt the canonical registry.
    return {request: structuredClone({...request, acquisition_hint: reference}), state: "reviewed", guidance: structuredClone(guidance)};
  };
  return Object.freeze({resolve: (value: unknown, context: AnalysisContext, scenario: Scenario | null) => run(value, context, scenario, false), attach: (value: unknown, context: AnalysisContext, scenario: Scenario | null) => run(value, context, scenario, true)});
}

// No candidate, AI assessment or owner implementation authorization is a release allowlist.
export const acquisitionResolver = createAcquisitionResolver(null, Object.freeze([]));
