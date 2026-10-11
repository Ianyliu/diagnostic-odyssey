import {
  assertValidReviewedLinkedConditionPackage
} from "@diagnostic-odyssey/contracts";

import candidateFileJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/linked-condition-candidate-estimates.json" with { type: "json" };
import reviewedDiagnosticsJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/reviewed-diagnostics.json" with { type: "json" };
import sourceMetadataJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/source-metadata.json" with { type: "json" };
import runManifestJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/github-actions-run-manifest.json" with { type: "json" };
import reviewManifestJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/review-manifest.json" with { type: "json" };
import productPolicyJson from "../../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/product-policy.json" with { type: "json" };

export const ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION =
  "meps-2024-linked-condition-service-use-reviewed-20260929-v1" as const;

export const ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION =
  "linked_condition_product_policy_v1" as const;

const CANDIDATE_A_ID = "u09_linked_service_use_person_share" as const;

const ACTIVE_PRODUCT_POLICY_ASSIGNMENTS = {
  u09_linked_service_use_person_share: "admitted_secondary_descriptive",
  u09_linked_service_use_encounters_mean: "reviewed_not_product_admitted",
  u09_linked_service_use_office_encounters_mean: "reviewed_not_product_admitted",
  u09_linked_service_use_outpatient_encounters_mean: "suppressed_precision",
  u09_linked_service_use_emergency_encounters_mean: "suppressed_precision",
  u09_linked_service_use_inpatient_encounters_mean: "suppressed_unsupported_zero"
} as const;

export interface ReviewedLinkedConditionPackageInput {
  candidateFile: unknown;
  reviewedDiagnostics: unknown;
  sourceMetadata: unknown;
  runManifest: unknown;
  reviewManifest: unknown;
  productPolicy: unknown;
}

export interface ReviewedLinkedConditionSecondaryEvidence {
  readonly kind: "reviewed_linked_condition_secondary_evidence";
  readonly artifactVersion: typeof ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION;
  readonly productPolicyVersion: typeof ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION;
  readonly candidateId: typeof CANDIDATE_A_ID;
  readonly value: number;
  readonly intervalLow: number;
  readonly intervalHigh: number;
  readonly intervalType: string;
  readonly precisionStatus: "meps_precise";
  readonly precisionReportingStatus: "reportable";
  readonly sectionHeading: string;
  readonly measureLabel: string;
  readonly alwaysVisibleExplanation: string;
  readonly technicalLimitations: readonly string[];
  readonly support: {
    readonly governedTargetN: number;
    readonly personsWithQualifyingLinkedEncounterN: number;
    readonly qualifyingTargetEncounterN: number;
    readonly weightedTargetDenominator: number;
    readonly fullDesignDegreesOfFreedom: number;
  };
  readonly provenance: {
    readonly dataset: "MEPS 2024";
    readonly sourceLabels: readonly string[];
  };
}

export type ReviewedLinkedConditionRuntimeState =
  | { readonly status: "loaded"; readonly evidence: ReviewedLinkedConditionSecondaryEvidence }
  | { readonly status: "unavailable"; readonly evidence: null };

const immutableReviewedPackage: ReviewedLinkedConditionPackageInput = {
  candidateFile: candidateFileJson,
  reviewedDiagnostics: reviewedDiagnosticsJson,
  sourceMetadata: sourceMetadataJson,
  runManifest: runManifestJson,
  reviewManifest: reviewManifestJson,
  productPolicy: productPolicyJson
};

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid linked-condition runtime selection: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid linked-condition runtime selection: ${label} must be a non-empty string`);
  }
  return value;
};

const numberValue = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid linked-condition runtime selection: ${label} must be a finite number`);
  }
  return value;
};

const stringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || item.length === 0)) {
    throw new Error(`Invalid linked-condition runtime selection: ${label} must be a string array`);
  }
  return [...value] as string[];
};

export function selectReviewedLinkedConditionSecondaryEvidence(
  input: ReviewedLinkedConditionPackageInput
): ReviewedLinkedConditionSecondaryEvidence {
  assertValidReviewedLinkedConditionPackage(input);

  const reviewManifest = record(input.reviewManifest, "review manifest");
  const productPolicy = record(input.productPolicy, "product policy");
  const candidateFile = record(input.candidateFile, "candidate file");
  const sourceMetadata = record(input.sourceMetadata, "source metadata");

  if (reviewManifest.artifact_version !== ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION) {
    throw new Error("Invalid linked-condition runtime selection: reviewed artifact version is not the active pin");
  }
  if (productPolicy.reviewed_artifact_version !== ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION) {
    throw new Error("Invalid linked-condition runtime selection: policy artifact version does not match the active pin");
  }
  if (reviewManifest.product_policy_version !== ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION) {
    throw new Error("Invalid linked-condition runtime selection: review-manifest policy version is not the active pin");
  }
  if (productPolicy.policy_version !== ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION) {
    throw new Error("Invalid linked-condition runtime selection: product-policy version is not the active pin");
  }

  const states = productPolicy.candidate_states;
  if (!Array.isArray(states)) {
    throw new Error("Invalid linked-condition runtime selection: candidate policy states are missing");
  }
  const stateById = new Map<string, string>();
  for (const item of states) {
    const state = record(item, "candidate policy state");
    const id = stringValue(state.candidate_id, "candidate policy ID");
    const assignment = stringValue(state.product_policy_state, "candidate product-policy state");
    if (stateById.has(id)) {
      throw new Error("Invalid linked-condition runtime selection: duplicate candidate policy state");
    }
    stateById.set(id, assignment);
  }
  for (const [id, expected] of Object.entries(ACTIVE_PRODUCT_POLICY_ASSIGNMENTS)) {
    if (stateById.get(id) !== expected) {
      throw new Error(`Invalid linked-condition runtime selection: product-policy assignment drift for ${id}`);
    }
  }
  if (stateById.size !== Object.keys(ACTIVE_PRODUCT_POLICY_ASSIGNMENTS).length) {
    throw new Error("Invalid linked-condition runtime selection: unexpected candidate policy state");
  }

  if (!Array.isArray(candidateFile.candidates)) {
    throw new Error("Invalid linked-condition runtime selection: reviewed candidates are missing");
  }
  const candidateA = candidateFile.candidates
    .map(item => record(item, "reviewed candidate"))
    .find(item => item.candidate_id === CANDIDATE_A_ID);
  if (!candidateA) {
    throw new Error("Invalid linked-condition runtime selection: Candidate A is missing");
  }

  if (candidateA.computationally_valid !== true) {
    throw new Error("Invalid linked-condition runtime selection: Candidate A is not computationally valid");
  }
  if (candidateA.precision_status !== "meps_precise") {
    throw new Error("Invalid linked-condition runtime selection: Candidate A precision state is not meps_precise");
  }
  if (candidateA.precision_reporting_status !== "reportable") {
    throw new Error("Invalid linked-condition runtime selection: Candidate A precision reporting state is not reportable");
  }
  if (candidateA.product_release_eligible !== false) {
    throw new Error("Invalid linked-condition runtime selection: historical Candidate A release flag must remain false");
  }

  const presentation = record(productPolicy.candidate_a_presentation, "Candidate A presentation");
  if (presentation.candidate_id !== CANDIDATE_A_ID) {
    throw new Error("Invalid linked-condition runtime selection: Candidate A presentation ID mismatch");
  }

  if (!Array.isArray(sourceMetadata.sources)) {
    throw new Error("Invalid linked-condition runtime selection: reviewed source metadata is missing");
  }
  const sourceLabels = sourceMetadata.sources.map((item, index) =>
    stringValue(record(item, `source ${index + 1}`).label, `source ${index + 1} label`)
  );

  return {
    kind: "reviewed_linked_condition_secondary_evidence",
    artifactVersion: ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION,
    productPolicyVersion: ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION,
    candidateId: CANDIDATE_A_ID,
    value: numberValue(candidateA.value, "Candidate A value"),
    intervalLow: numberValue(candidateA.interval_low, "Candidate A interval low"),
    intervalHigh: numberValue(candidateA.interval_high, "Candidate A interval high"),
    intervalType: stringValue(candidateA.interval_type, "Candidate A interval type"),
    precisionStatus: "meps_precise",
    precisionReportingStatus: "reportable",
    sectionHeading: stringValue(presentation.section_heading, "Candidate A section heading"),
    measureLabel: stringValue(presentation.measure_label, "Candidate A measure label"),
    alwaysVisibleExplanation: stringValue(
      presentation.always_visible_explanation,
      "Candidate A always-visible explanation"
    ),
    technicalLimitations: stringArray(
      presentation.technical_limitations,
      "Candidate A technical limitations"
    ),
    support: {
      governedTargetN: numberValue(candidateA.unweighted_target_n, "Candidate A target n"),
      personsWithQualifyingLinkedEncounterN: numberValue(
        candidateA.unweighted_nonzero_person_n,
        "Candidate A nonzero-person n"
      ),
      qualifyingTargetEncounterN: numberValue(
        candidateA.observed_qualifying_event_n,
        "Candidate A qualifying encounter n"
      ),
      weightedTargetDenominator: numberValue(
        candidateA.weighted_denominator,
        "Candidate A weighted denominator"
      ),
      fullDesignDegreesOfFreedom: numberValue(
        candidateA.ci_degrees_of_freedom,
        "Candidate A full-design degrees of freedom"
      )
    },
    provenance: {
      dataset: "MEPS 2024",
      sourceLabels
    }
  };
}

export function loadReviewedLinkedConditionSecondaryEvidence():
  ReviewedLinkedConditionSecondaryEvidence {
  return selectReviewedLinkedConditionSecondaryEvidence(immutableReviewedPackage);
}

export function tryLoadReviewedLinkedConditionSecondaryEvidence(
  loader: () => ReviewedLinkedConditionSecondaryEvidence = loadReviewedLinkedConditionSecondaryEvidence
): ReviewedLinkedConditionRuntimeState {
  try {
    return {
      status: "loaded",
      evidence: loader()
    };
  } catch {
    return { status: "unavailable", evidence: null };
  }
}
