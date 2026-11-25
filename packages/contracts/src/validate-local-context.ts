import { dataStates } from "./constants.ts";
import { isRecord, isNonEmptyString, isNullableFiniteNumber, oneOf } from "./guards.ts";
import type { LocalContextArtifact, ValidationIssue } from "./types.ts";

export function validateLocalContextRecord(
  value: unknown,
  path = "local_context"
): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  for (const key of [
    "indicator_id", "label", "geography_name", "source_agency", "source_ref",
    "source_locator", "source_release_vintage", "unit", "universe",
    "allowed_interpretation"
  ]) {
    if (!isNonEmptyString(value[key])) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    }
  }

  if (value.geography_type !== "state" && value.geography_type !== "county") {
    issues.push({ path: `${path}.geography_type`, message: "must be state or county" });
  }
  if (typeof value.state_fips !== "string" || !/^\d{2}$/.test(value.state_fips)) {
    issues.push({ path: `${path}.state_fips`, message: "must be a two-digit FIPS code" });
  }

  const countyFips = value.county_fips;
  if (value.geography_type === "state" && countyFips !== null) {
    issues.push({ path: `${path}.county_fips`, message: "must be null for state geography" });
  }
  if (value.geography_type === "county") {
    if (typeof countyFips !== "string" || !/^\d{5}$/.test(countyFips)) {
      issues.push({ path: `${path}.county_fips`, message: "must be a five-digit FIPS code for county geography" });
    } else if (typeof value.state_fips === "string" && !countyFips.startsWith(value.state_fips)) {
      issues.push({ path: `${path}.county_fips`, message: "must begin with state_fips" });
    }
  }

  if (!(value.value === null || typeof value.value === "string" ||
        (typeof value.value === "number" && Number.isFinite(value.value)))) {
    issues.push({ path: `${path}.value`, message: "must be a finite number, string, or null" });
  }

  if (!isNullableFiniteNumber(value.margin_of_error) ||
      (typeof value.margin_of_error === "number" && value.margin_of_error < 0)) {
    issues.push({ path: `${path}.margin_of_error`, message: "must be a non-negative finite number or null" });
  }
  if (!(value.confidence_level === null ||
        (typeof value.confidence_level === "number" && Number.isFinite(value.confidence_level) &&
         value.confidence_level > 0 && value.confidence_level <= 1))) {
    issues.push({ path: `${path}.confidence_level`, message: "must be in (0, 1] or null" });
  }
  if (!(value.observation_as_of_date === null || isNonEmptyString(value.observation_as_of_date))) {
    issues.push({ path: `${path}.observation_as_of_date`, message: "must be a non-empty string or null" });
  }
  if (!(value.uncertainty_type === null || isNonEmptyString(value.uncertainty_type))) {
    issues.push({ path: `${path}.uncertainty_type`, message: "must be a non-empty string or null" });
  }

  if (value.context_type !== "contextual_indicator") {
    issues.push({ path: `${path}.context_type`, message: "must be contextual_indicator" });
  }
  if (!oneOf(value.state, dataStates)) {
    issues.push({ path: `${path}.state`, message: "invalid data state" });
  }
  if (value.release_status !== "preliminary" && value.release_status !== "reviewed_released") {
    issues.push({ path: `${path}.release_status`, message: "must be preliminary or reviewed_released" });
  }

  if (!Array.isArray(value.limitations) || value.limitations.some(item => !isNonEmptyString(item))) {
    issues.push({ path: `${path}.limitations`, message: "must be an array of non-empty strings" });
  }
  if (!Array.isArray(value.prohibited_interpretation) ||
      value.prohibited_interpretation.length === 0 ||
      value.prohibited_interpretation.some(item => !isNonEmptyString(item))) {
    issues.push({ path: `${path}.prohibited_interpretation`, message: "must contain at least one non-empty string" });
  }

  if (value.source_agency === "U.S. Census Bureau") {
    if (value.margin_of_error === null) {
      issues.push({ path: `${path}.margin_of_error`, message: "ACS profile percentages must preserve the published MOE" });
    }
    if (value.confidence_level !== 0.9) {
      issues.push({ path: `${path}.confidence_level`, message: "ACS profile MOE confidence level must remain 0.9" });
    }
    if (value.uncertainty_type !== "published_90_percent_margin_of_error") {
      issues.push({ path: `${path}.uncertainty_type`, message: "ACS uncertainty must be the published 90% margin of error" });
    }
  }

  return issues;
}

export function validateLocalContextArtifact(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "local_artifact", message: "must be an object" }];
  const issues: ValidationIssue[] = [];
  const manifest = value.manifest;
  const geography = value.geography;

  if (!isRecord(manifest)) {
    issues.push({ path: "local_artifact.manifest", message: "must be an object" });
  } else {
    if (manifest.artifact_family !== "local_context") {
      issues.push({ path: "local_artifact.manifest.artifact_family", message: "must be local_context" });
    }
    for (const key of [
      "artifact_version", "generated_at", "code_commit", "run_id",
      "national_meps_artifact_version"
    ]) {
      if (!isNonEmptyString(manifest[key])) {
        issues.push({ path: `local_artifact.manifest.${key}`, message: "must be a non-empty string" });
      }
    }
    if (manifest.release_status !== "preliminary" && manifest.release_status !== "reviewed_released") {
      issues.push({ path: "local_artifact.manifest.release_status", message: "invalid local release status" });
    }
    if (manifest.national_meps_burden_unchanged !== true) {
      issues.push({
        path: "local_artifact.manifest.national_meps_burden_unchanged",
        message: "must be true"
      });
    }
  }

  if (!isRecord(geography)) {
    issues.push({ path: "local_artifact.geography", message: "must be an object" });
  } else {
    if (!isNonEmptyString(geography.geography_name)) {
      issues.push({ path: "local_artifact.geography.geography_name", message: "must be a non-empty string" });
    }
    if (geography.geography_type !== "state" && geography.geography_type !== "county") {
      issues.push({ path: "local_artifact.geography.geography_type", message: "must be state or county" });
    }
    if (typeof geography.state_fips !== "string" || !/^\d{2}$/.test(geography.state_fips)) {
      issues.push({ path: "local_artifact.geography.state_fips", message: "must be a two-digit FIPS code" });
    }
    if (geography.geography_type === "state" && geography.county_fips !== null) {
      issues.push({ path: "local_artifact.geography.county_fips", message: "must be null for state geography" });
    }
    if (geography.geography_type === "county" &&
        (typeof geography.county_fips !== "string" || !/^\d{5}$/.test(geography.county_fips))) {
      issues.push({ path: "local_artifact.geography.county_fips", message: "must be a five-digit FIPS code" });
    }
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    issues.push({ path: "local_artifact.sources", message: "must contain at least one source" });
  }
  const sourceRefs = new Set<string>();
  if (Array.isArray(value.sources)) {
    value.sources.forEach((source, index) => {
      const sourcePath = `local_artifact.sources[${index}]`;
      if (!isRecord(source)) {
        issues.push({ path: sourcePath, message: "must be an object" });
        return;
      }
      for (const key of [
        "source_ref", "source_agency", "source_name", "source_locator",
        "source_release_vintage", "retrieved_at"
      ]) {
        if (!isNonEmptyString(source[key])) {
          issues.push({ path: `${sourcePath}.${key}`, message: "must be a non-empty string" });
        }
      }
      if (isNonEmptyString(source.source_ref)) sourceRefs.add(source.source_ref);
      if (!(source.byte_size === null ||
            (typeof source.byte_size === "number" && Number.isFinite(source.byte_size) && source.byte_size >= 0))) {
        issues.push({ path: `${sourcePath}.byte_size`, message: "must be a non-negative finite number or null" });
      }
      if (!(source.sha256 === null || (typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256)))) {
        issues.push({ path: `${sourcePath}.sha256`, message: "must be a lowercase SHA-256 string or null" });
      }
      if (source.source_ref === "acs-2024-5year-profile") {
        if (!(typeof source.byte_size === "number" && Number.isFinite(source.byte_size) && source.byte_size > 0)) {
          issues.push({
            path: `${sourcePath}.byte_size`,
            message: "ACS source snapshots must have a positive deterministic canonical byte size"
          });
        }
        if (!(typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256))) {
          issues.push({
            path: `${sourcePath}.sha256`,
            message: "ACS source snapshots must have a deterministic SHA-256"
          });
        }
      }
    });
  }

  if (!Array.isArray(value.indicators) || value.indicators.length === 0) {
    issues.push({ path: "local_artifact.indicators", message: "must contain at least one indicator" });
  } else {
    value.indicators.forEach((record, index) => {
      const recordPath = `local_artifact.indicators[${index}]`;
      issues.push(...validateLocalContextRecord(record, recordPath));
      if (!isRecord(record)) return;

      if (isRecord(manifest) &&
          (manifest.release_status === "preliminary" || manifest.release_status === "reviewed_released") &&
          record.release_status !== manifest.release_status) {
        issues.push({ path: `${recordPath}.release_status`, message: "must match manifest release_status" });
      }
      if (isRecord(geography)) {
        for (const key of ["geography_name", "geography_type", "state_fips", "county_fips"]) {
          if (record[key] !== geography[key]) {
            issues.push({ path: `${recordPath}.${key}`, message: "must match local_artifact.geography" });
          }
        }
      }
      if (isNonEmptyString(record.source_ref) && !sourceRefs.has(record.source_ref)) {
        issues.push({ path: `${recordPath}.source_ref`, message: "must reference local_artifact.sources" });
      }
    });
  }

  return issues;
}

export function assertValidLocalContextArtifact(value: unknown): asserts value is LocalContextArtifact {
  const issues = validateLocalContextArtifact(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid Diagnostic Odyssey local-context artifact:\n${issues.map(i => `- ${i.path}: ${i.message}`).join("\n")}`
    );
  }
}

export function canLoadReviewedLocalContextArtifact(
  artifact: unknown
): artifact is LocalContextArtifact {
  if (validateLocalContextArtifact(artifact).length > 0) return false;
  const reviewed = artifact as LocalContextArtifact;
  return reviewed.manifest.release_status === "reviewed_released" &&
    reviewed.indicators.length > 0 &&
    reviewed.indicators.every(record => record.release_status === "reviewed_released");
}
