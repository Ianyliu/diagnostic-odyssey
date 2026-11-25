import { evidenceTypes, releaseStatuses, displayStatuses } from "./constants.ts";
import type { ReleaseStatus } from "./constants.ts";
import { isRecord, isNonEmptyString, isNullableFiniteNumber, oneOf } from "./guards.ts";
import type { ValidationIssue } from "./types.ts";

export function validateEstimate(value: unknown, path = "estimate"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return [{ path, message: "must be an object" }];

  const requiredStrings = [
    "estimate_id", "measure_id", "label", "unit", "denominator", "universe",
    "system_boundary", "source_ref", "artifact_version", "allowed_interpretation"
  ];
  for (const key of requiredStrings) {
    if (!isNonEmptyString(value[key])) issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
  }

  if (!isNullableFiniteNumber(value.value)) issues.push({ path: `${path}.value`, message: "must be a finite number or null" });
  if (!isNullableFiniteNumber(value.interval_low)) issues.push({ path: `${path}.interval_low`, message: "must be a finite number or null" });
  if (!isNullableFiniteNumber(value.interval_high)) issues.push({ path: `${path}.interval_high`, message: "must be a finite number or null" });
  if (!oneOf(value.evidence_type, evidenceTypes)) issues.push({ path: `${path}.evidence_type`, message: "invalid evidence type" });
  if (!oneOf(value.release_status, releaseStatuses)) issues.push({ path: `${path}.release_status`, message: "invalid release status" });
  if (!oneOf(value.display_status, displayStatuses)) issues.push({ path: `${path}.display_status`, message: "invalid display status" });

  const hiddenStatuses: ReleaseStatus[] = ["not_released", "suppressed", "unavailable"];
  if (hiddenStatuses.includes(value.release_status as ReleaseStatus) && value.value !== null) {
    issues.push({ path: `${path}.value`, message: "must be null when result is not released, suppressed, or unavailable" });
  }

  if (value.interval_low !== null && value.interval_high !== null &&
      typeof value.interval_low === "number" && typeof value.interval_high === "number" &&
      value.interval_low > value.interval_high) {
    issues.push({ path, message: "interval_low cannot exceed interval_high" });
  }

  const isNumericAnalyticalArtifact =
    value.display_status === "analytical_artifact" &&
    typeof value.value === "number" &&
    Number.isFinite(value.value);

  if (isNumericAnalyticalArtifact) {
    const provenanceStrings = [
      "weight_variable",
      "variance_stratum_variable",
      "variance_psu_variable",
      "source_locator",
      "cohort_definition",
      "statistics_method",
      "ci_df_source"
    ];
    for (const key of provenanceStrings) {
      if (!isNonEmptyString(value[key])) {
        issues.push({
          path: `${path}.${key}`,
          message: "is required for a numeric analytical artifact"
        });
      }
    }

    for (const key of ["standard_error", "weighted_denominator", "unweighted_n"]) {
      const candidate = value[key];
      if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
        issues.push({
          path: `${path}.${key}`,
          message: "must be a non-negative finite number for a numeric analytical artifact"
        });
      }
    }

    const ciDf = value.ci_degrees_of_freedom;
    if (typeof ciDf !== "number" || !Number.isFinite(ciDf) || ciDf <= 0) {
      issues.push({
        path: `${path}.ci_degrees_of_freedom`,
        message: "must be a positive finite number for a numeric analytical artifact"
      });
    }
  }

  if (value.distribution_summary !== undefined) {
    const summaryPath = `${path}.distribution_summary`;
    const summary = value.distribution_summary;
    if (!isRecord(summary)) {
      issues.push({ path: summaryPath, message: "must be an object" });
    } else {
      if (summary.summary_type !== "survey_weighted_quantiles") {
        issues.push({
          path: `${summaryPath}.summary_type`,
          message: "must be survey_weighted_quantiles"
        });
      }

      for (const key of [
        "source_variable",
        "weight_variable",
        "variance_stratum_variable",
        "variance_psu_variable",
        "statistics_method"
      ]) {
        if (!isNonEmptyString(summary[key])) {
          issues.push({
            path: `${summaryPath}.${key}`,
            message: "must be a non-empty string"
          });
        }
      }

      for (const key of ["p25", "p50", "p75", "weighted_denominator"]) {
        const candidate = summary[key];
        if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
          issues.push({
            path: `${summaryPath}.${key}`,
            message: "must be a finite number"
          });
        }
      }

      if (
        typeof summary.weighted_denominator === "number" &&
        Number.isFinite(summary.weighted_denominator) &&
        summary.weighted_denominator < 0
      ) {
        issues.push({
          path: `${summaryPath}.weighted_denominator`,
          message: "must be non-negative"
        });
      }

      if (
        typeof summary.unweighted_n !== "number" ||
        !Number.isFinite(summary.unweighted_n) ||
        !Number.isInteger(summary.unweighted_n) ||
        summary.unweighted_n < 0
      ) {
        issues.push({
          path: `${summaryPath}.unweighted_n`,
          message: "must be a non-negative integer"
        });
      }

      if (
        typeof summary.p25 === "number" && Number.isFinite(summary.p25) &&
        typeof summary.p50 === "number" && Number.isFinite(summary.p50) &&
        summary.p25 > summary.p50
      ) {
        issues.push({ path: summaryPath, message: "p25 cannot exceed p50" });
      }
      if (
        typeof summary.p50 === "number" && Number.isFinite(summary.p50) &&
        typeof summary.p75 === "number" && Number.isFinite(summary.p75) &&
        summary.p50 > summary.p75
      ) {
        issues.push({ path: summaryPath, message: "p50 cannot exceed p75" });
      }

      if (
        !Array.isArray(summary.limitations) ||
        summary.limitations.some(item => !isNonEmptyString(item))
      ) {
        issues.push({
          path: `${summaryPath}.limitations`,
          message: "must be an array of non-empty strings"
        });
      }

      if (!isNumericAnalyticalArtifact) {
        issues.push({
          path: summaryPath,
          message: "requires a numeric analytical parent estimate"
        });
      }

      for (const [summaryKey, parentKey] of [
        ["weight_variable", "weight_variable"],
        ["variance_stratum_variable", "variance_stratum_variable"],
        ["variance_psu_variable", "variance_psu_variable"]
      ] as const) {
        if (
          isNonEmptyString(summary[summaryKey]) &&
          isNonEmptyString(value[parentKey]) &&
          summary[summaryKey] !== value[parentKey]
        ) {
          issues.push({
            path: `${summaryPath}.${summaryKey}`,
            message: `must match parent estimate ${parentKey}`
          });
        }
      }

      if (
        typeof summary.unweighted_n === "number" &&
        Number.isFinite(summary.unweighted_n) &&
        Number.isInteger(summary.unweighted_n) &&
        typeof value.unweighted_n === "number" &&
        Number.isFinite(value.unweighted_n) &&
        summary.unweighted_n !== value.unweighted_n
      ) {
        issues.push({
          path: `${summaryPath}.unweighted_n`,
          message: "must equal parent estimate unweighted_n and use the same valid response denominator as the parent estimate"
        });
      }

      if (
        typeof summary.weighted_denominator === "number" &&
        Number.isFinite(summary.weighted_denominator) &&
        typeof value.weighted_denominator === "number" &&
        Number.isFinite(value.weighted_denominator) &&
        summary.weighted_denominator !== value.weighted_denominator
      ) {
        issues.push({
          path: `${summaryPath}.weighted_denominator`,
          message: "must match parent estimate weighted_denominator and use the same valid response denominator as the parent estimate"
        });
      }
    }
  }

  if (typeof value.component_of_measure_id === "string" &&
      value.component_of_measure_id === value.measure_id) {
    issues.push({
      path: `${path}.component_of_measure_id`,
      message: "cannot refer to the same measure_id"
    });
  }

  return issues;
}
