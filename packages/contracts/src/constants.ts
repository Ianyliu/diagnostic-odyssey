export const evidenceTypes = [
  "survey_estimate",
  "adjusted_association",
  "contextual_indicator",
  "literature_derived",
  "scenario_assumption",
  "qualitative_evidence"
] as const;

export const releaseStatuses = [
  "preliminary",
  "reviewed_released",
  "not_released",
  "suppressed",
  "unavailable"
] as const;

export const displayStatuses = ["illustrative", "analytical_artifact"] as const;

export const admissibilityStatuses = [
  "supported",
  "supported_with_bounds",
  "limited_use",
  "insufficient"
] as const;

export const dataStates = [
  "loading",
  "loaded",
  "partial",
  "empty",
  "suppressed",
  "error",
  "stale_fallback",
  "unsupported_combination"
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];
export type ReleaseStatus = (typeof releaseStatuses)[number];
export type DisplayStatus = (typeof displayStatuses)[number];
export type AdmissibilityStatus = (typeof admissibilityStatuses)[number];
export type DataState = (typeof dataStates)[number];
