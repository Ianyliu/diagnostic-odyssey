export const changeTypes = [
  "rule_change", "service_change", "capacity_change", "program_change", "funding_window", "economic_change",
  "infrastructure_change", "dataset_release", "methodology_change"
] as const;
export const domains = [
  "diagnostic_access", "specialty_care", "coverage_eligibility", "institutional_capacity", "public_policy",
  "funding", "economic_infrastructure", "data_methods"
] as const;
export const recordStatuses = [
  "proposed", "announced", "final", "effective", "implemented", "stayed", "rescinded", "expired", "unknown"
] as const;
export const dateRoles = [
  "announced", "source_published", "decided", "effective_start", "effective_end", "enforcement_start",
  "compliance_deadline", "comment_deadline", "expires"
] as const;
export const datePrecisions = ["date", "month", "year", "instant", "unknown"] as const;
export const geoRelations = ["located_in", "serves", "rules_apply_to", "mentioned_only"] as const;
export const assertionTypes = ["documented_action", "attributed_statement", "reported_condition"] as const;

export type ChangeType = typeof changeTypes[number];
export type Domain = typeof domains[number];
export type RecordStatus = typeof recordStatuses[number];
export type DateRole = typeof dateRoles[number];
export type DatePrecision = typeof datePrecisions[number];
export type GeoRelation = typeof geoRelations[number];
export type AssertionType = typeof assertionTypes[number];
