/**
 * Standalone, narrative-only source/claim contracts.
 * NEVER import or re-export EvidenceRecord, BoundedEffect, or scenario-engine types.
 * Runtime admissibility and immutable artifact promotion are out of scope for PR A.
 */
export type NarrativeCausalUseClass =
  | "clinical_guidance_non_effect"
  | "qualitative_experience"
  | "observational_pathway_description"
  | "noncausal_service_evaluation";
export type NarrativeAllowedUse = "planning_option_to_investigate" | "background_context_only";
export type NarrativeReviewerStatus = "draft" | "needs_review" | "approved" | "rejected";
/** reviewed_not_released means approved, with provenance, but not promoted. */
export type NarrativeReleaseStatus = "candidate" | "reviewed_not_released" | "reviewed_released" | "rejected";
export type NarrativeSourceKind = "clinical_guidance" | "peer_reviewed_article" | "official_report";
export type NarrativeLocatorKind = "section" | "table" | "page" | "paragraph" | "figure" | "web_heading";

export interface NarrativeSourceLocator {
  kind: NarrativeLocatorKind;
  detail: string;
}

export interface NarrativeSource {
  source_id: string;
  citation: string;
  title: string;
  authors: string[];
  publication_year: number;
  source_kind: NarrativeSourceKind;
  doi: string | null;
  pmcid: string | null;
  url: string;
  locators: NarrativeSourceLocator[];
  retrieved_at: string | null;
  /** Lowercase SHA-256 of the exact archived source bytes, not a webpage URL or a citation. */
  source_sha256: string | null;
}

export interface NarrativeApplicability {
  population: string;
  condition_definition: string;
  setting: string;
  payer: string;
  geography: string;
  pathway_step: string;
  mechanism: string;
  applicability_limits: string[];
}

export interface NarrativeReview {
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_note: string;
}

export interface NarrativeReference {
  claim_id: string;
  source: NarrativeSource;
  proposed_claim_wording: string;
  approved_claim_wording: string | null;
  prohibited_stronger_claims: string[];
  applicability: NarrativeApplicability;
  causal_use_class: NarrativeCausalUseClass;
  allowed_use: NarrativeAllowedUse;
  limitations: string[];
  reviewer_status: NarrativeReviewerStatus;
  review: NarrativeReview;
  release_status: NarrativeReleaseStatus;
  /** Structural wall: a narrative reference cannot become a quantitative effect. */
  quantitative_effect_eligible: false;
}

export interface NarrativeReferenceManifest {
  schema_version: "1.0";
  artifact_family: "narrative_intervention_references";
  catalog_id: string;
  release_status: "candidate" | "reviewed_released";
  generated_at: string;
  code_commit: string;
  review_manifest_sha256: string | null;
  /** Digest of the independently reviewed, versioned exact-context decision map. */
  applicability_manifest_sha256: string | null;
  automatic_release: false;
  quantitative_effect_eligible: false;
}

/** This is a contract shape, not an admitted or runtime-loaded artifact. */
export interface NarrativeReferenceCatalog {
  manifest: NarrativeReferenceManifest;
  records: NarrativeReference[];
}

export interface NarrativeValidationIssue {
  path: string;
  message: string;
}
