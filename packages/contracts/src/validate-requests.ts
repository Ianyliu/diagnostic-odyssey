import { isRecord, isNonEmptyString } from "./guards.ts";
import type { ValidationIssue } from "./types.ts";

export function validateDataRequest(
  value: unknown,
  path = "data_request"
): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  for (const key of [
    "request_id",
    "target_question",
    "pathway_step",
    "likely_source_owner",
    "granularity_time_window",
    "rationale",
    "feasibility_privacy_notes"
  ]) {
    if (!isNonEmptyString(value[key])) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    }
  }

  if (
    value.target_mechanism !== undefined &&
    value.target_mechanism !== null &&
    !isNonEmptyString(value.target_mechanism)
  ) {
    issues.push({
      path: `${path}.target_mechanism`,
      message: "must be null or a non-empty string"
    });
  }

  if (
    !Array.isArray(value.fields_needed) ||
    value.fields_needed.some(item => !isNonEmptyString(item))
  ) {
    issues.push({
      path: `${path}.fields_needed`,
      message: "must be an array of non-empty strings"
    });
  }

  if (Object.hasOwn(value, "acquisition_hint")) {
    issues.push(...validateAcquisitionHintReference(value.acquisition_hint, `${path}.acquisition_hint`));
  }
  return issues;
}

export function validateAcquisitionHintReference(value: unknown, path = "acquisition_hint"): ValidationIssue[] {
  if (!isRecord(value)) return [{path, message: "must be a closed versioned reference object"}];
  const keys = ["schema_version", "hint_id", "hint_version", "registry_sha256", "policy_sha256", "source_index_sha256", "review_sha256", "request_fingerprint"];
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) issues.push({path: `${path}.${key}`, message: "unexpected reference field"});
  }
  if (value.schema_version !== "1") issues.push({path: `${path}.schema_version`, message: "must be 1"});
  if (value.hint_id !== "ACQ26-TIMING-01" && value.hint_id !== "ACQ26-CAPACITY-01") issues.push({path: `${path}.hint_id`, message: "unknown hint ID"});
  if (value.hint_version !== "2") issues.push({path: `${path}.hint_version`, message: "unsupported hint version"});
  for (const key of keys.slice(3)) {
    if (typeof value[key] !== "string" || !/^[a-f0-9]{64}$/.test(value[key])) {
      issues.push({path: `${path}.${key}`, message: "must be an exact lowercase SHA-256"});
    }
  }
  return issues;
}
