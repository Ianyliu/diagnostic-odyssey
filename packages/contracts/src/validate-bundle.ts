import { displayStatuses, dataStates } from "./constants.ts";
import { isRecord, isNonEmptyString, oneOf } from "./guards.ts";
import type { ArtifactBundle, ValidationIssue } from "./types.ts";
import { validateEstimate } from "./validate-estimate.ts";
import { validateScenario } from "./validate-scenario.ts";
import { validateDataRequest } from "./validate-requests.ts";

export function validateArtifactBundle(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "artifact", message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  const manifest = value.manifest;
  const context = value.context;

  if (!isRecord(manifest)) {
    issues.push({ path: "artifact.manifest", message: "must be an object" });
  } else {
    for (const key of ["artifact_version", "generated_at", "code_commit", "run_id"]) {
      if (!isNonEmptyString(manifest[key])) {
        issues.push({ path: `artifact.manifest.${key}`, message: "must be a non-empty string" });
      }
    }
    if (!oneOf(manifest.display_status, displayStatuses)) {
      issues.push({ path: "artifact.manifest.display_status", message: "invalid display status" });
    }
    if (!Array.isArray(manifest.dataset_releases) ||
        manifest.dataset_releases.length === 0 ||
        manifest.dataset_releases.some(item => !isNonEmptyString(item))) {
      issues.push({
        path: "artifact.manifest.dataset_releases",
        message: "must contain at least one non-empty dataset release"
      });
    }
  }

  if (!isRecord(context)) {
    issues.push({ path: "artifact.context", message: "must be an object" });
  } else {
    for (const key of ["condition_id", "cohort_id", "age_range", "geography_scope", "artifact_version"]) {
      if (!isNonEmptyString(context[key])) {
        issues.push({ path: `artifact.context.${key}`, message: "must be a non-empty string" });
      }
    }
    if (typeof context.evidence_year !== "number" || !Number.isFinite(context.evidence_year)) {
      issues.push({ path: "artifact.context.evidence_year", message: "must be a finite number" });
    }
    if (isRecord(manifest) &&
        isNonEmptyString(manifest.artifact_version) &&
        context.artifact_version !== manifest.artifact_version) {
      issues.push({
        path: "artifact.context.artifact_version",
        message: "must match artifact.manifest.artifact_version"
      });
    }
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    issues.push({ path: "artifact.sources", message: "must contain at least one source record" });
  } else {
    value.sources.forEach((source, index) => {
      const path = `artifact.sources[${index}]`;
      if (!isRecord(source)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      for (const key of ["source_ref", "source_name", "locator"]) {
        if (!isNonEmptyString(source[key])) {
          issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
        }
      }
      if (typeof source.official_url !== "string") {
        issues.push({ path: `${path}.official_url`, message: "must be a string" });
      }
      if (typeof source.release_year !== "number" || !Number.isFinite(source.release_year)) {
        issues.push({ path: `${path}.release_year`, message: "must be a finite number" });
      }
    });
  }

  const sourceRefs = new Set(
    Array.isArray(value.sources)
      ? value.sources
          .filter(isRecord)
          .map(source => source.source_ref)
          .filter(isNonEmptyString)
      : []
  );

  if (!Array.isArray(value.burden_domains)) {
    issues.push({ path: "artifact.burden_domains", message: "must be an array" });
  } else {
    value.burden_domains.forEach((domain, domainIndex) => {
      if (!isRecord(domain)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}]`, message: "must be an object" });
        return;
      }
      if (!oneOf(domain.availability_state, dataStates)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}].availability_state`, message: "invalid data state" });
      }
      if (!Array.isArray(domain.measures)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}].measures`, message: "must be an array" });
      } else {
        domain.measures.forEach((estimate, estimateIndex) => {
          const estimatePath = `artifact.burden_domains[${domainIndex}].measures[${estimateIndex}]`;
          issues.push(...validateEstimate(estimate, estimatePath));
          if (isRecord(estimate)) {
            if (isRecord(manifest) &&
                isNonEmptyString(manifest.artifact_version) &&
                estimate.artifact_version !== manifest.artifact_version) {
              issues.push({
                path: `${estimatePath}.artifact_version`,
                message: "must match artifact.manifest.artifact_version"
              });
            }
            if (isNonEmptyString(estimate.source_ref) && !sourceRefs.has(estimate.source_ref)) {
              issues.push({
                path: `${estimatePath}.source_ref`,
                message: "must reference an artifact.sources entry"
              });
            }
          }
        });
      }
    });
  }

  if (!Array.isArray(value.scenario_examples)) {
    issues.push({ path: "artifact.scenario_examples", message: "must be an array" });
  } else {
    value.scenario_examples.forEach((scenario, index) => {
      issues.push(...validateScenario(scenario, `artifact.scenario_examples[${index}]`));
    });
  }

  if (!Array.isArray(value.data_requests)) {
    issues.push({ path: "artifact.data_requests", message: "must be an array" });
  } else {
    value.data_requests.forEach((request, index) => {
      issues.push(...validateDataRequest(request, `artifact.data_requests[${index}]`));
    });
  }

  return issues;
}

export function assertValidArtifactBundle(value: unknown): asserts value is ArtifactBundle {
  const issues = validateArtifactBundle(value);
  if (issues.length > 0) {
    throw new Error(`Invalid Diagnostic Odyssey artifact:\n${issues.map(i => `- ${i.path}: ${i.message}`).join("\n")}`);
  }
}
