import type { AcquisitionHintReference, AnalysisContext, DataRequest, Scenario } from "@diagnostic-odyssey/contracts";

export interface AcquisitionMapping {
  candidate_hint_id: AcquisitionHintReference["hint_id"];
  candidate_version: "2";
  eligible_request_family: string;
  source_owner_system: string;
  required_information: string[];
  minimum_necessary_output: string;
  local_only_preparation: string;
  official_support: {
    version: "FHIR R4 4.0.1"; url: string; source_path: string; source_sha256: string;
    retrieved_at: string; publication_note: string;
    elements: {element: string; official_locator: string}[];
  }[];
  mapping_limits: string[];
  local_confirmation: string[];
  review_status: string;
  review_provenance: unknown;
  existing_requested_fields: string[];
  field_crosswalk: {existing_field: string; possible_spec_elements: string | null; limits: string}[];
  preparation_recommendation: string;
  proposed_guidance_wording: string;
  privacy_limits: string[];
}

/** Exact UTF-8 JSON preimages; archival documents are verified offline, never bundled here. */
export interface AcquisitionReleaseBytes {
  registry: string;
  mapping: string;
  policy: string;
  sourceIndex: string;
  review: string;
  applicationContext: string;
  artifact: string;
}

export interface AcquisitionGuidance {
  request_id: string;
  reference: AcquisitionHintReference;
  wording: string;
  source_owner_system: string;
  required_information: string[];
  minimum_necessary_output: string;
  local_only_preparation: string;
  official_support: AcquisitionMapping["official_support"];
  field_crosswalk: AcquisitionMapping["field_crosswalk"];
  mapping_limits: string[];
  local_confirmation: string[];
  privacy_limits: string[];
  privacy_boundary: "Aggregate steward-approved summaries and counts only. No individual-level intervals, raw dates, identifiers, patient or employee records enter this app.";
  review: {reviewer: string; reviewed_at: string; evidence_url: string; code_commit: string};
  registry_id: string;
  registry_version: string;
}

export type AcquisitionState = "not_offered" | "awaiting_admission" | "available_to_attach" | "reviewed" | "invalid_reference" | "stale_reference" | "not_applicable" | "artifact_unavailable";
export interface AcquisitionResolution {
  request: DataRequest;
  state: AcquisitionState;
  guidance?: AcquisitionGuidance;
}
export interface AcquisitionResolver {
  resolve(request: unknown, context: AnalysisContext, scenario: Scenario | null): AcquisitionResolution;
  attach(request: unknown, context: AnalysisContext, scenario: Scenario | null): AcquisitionResolution;
}
