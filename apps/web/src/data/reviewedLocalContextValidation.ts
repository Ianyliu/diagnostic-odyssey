import {
  assertValidLocalContextArtifact,
  canLoadReviewedLocalContextArtifact,
  type LocalContextArtifact
} from "@diagnostic-odyssey/contracts";

export const REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION =
  "local-context-wv-hrsa-acs-candidate-20260924T052332Z";

export const REVIEWED_WV_LOCAL_CONTEXT_DECLARED_NATIONAL_MEPS_ARTIFACT_VERSION =
  "meps-2024-long-covid-candidate-20260923T020607Z";

export const REVIEWED_WV_LOCAL_CONTEXT_COMPATIBLE_NATIONAL_MEPS_ARTIFACT_VERSIONS:
  readonly string[] = [
    REVIEWED_WV_LOCAL_CONTEXT_DECLARED_NATIONAL_MEPS_ARTIFACT_VERSION,
    "meps-2024-long-covid-candidate-20260926T011343Z"
  ];

// September 26 is explicitly compatible because the reviewed promotion proved
// no drift in the 21 pre-existing Estimate records after excluding only
// release_status, artifact_version, and distribution_summary. The only added
// analytical content is reviewed DistributionSummary metadata on two parent
// means. Unknown and future MEPS artifacts remain fail-closed.
export function assertReviewedWvLocalContextRuntimeCompatibility(
  runtimeMepsArtifactVersion: string
): void {
  if (
    !REVIEWED_WV_LOCAL_CONTEXT_COMPATIBLE_NATIONAL_MEPS_ARTIFACT_VERSIONS.includes(
      runtimeMepsArtifactVersion
    )
  ) {
    throw new Error(
      "Selected national MEPS runtime artifact is not explicitly reviewed-compatible " +
        "with the reviewed WV local-context artifact."
    );
  }
}

const REQUIRED_DECISION_INDICATOR_IDS = [
  "wv.hrsa.primary-care.designated-distinct-count",
  "wv.hrsa.primary-care.max-score",
  "wv.hrsa.mental-health.designated-distinct-count",
  "wv.hrsa.mental-health.max-score",
  "wv.acs.uninsured_pct",
  "wv.acs.no_vehicle_pct",
  "wv.acs.broadband_pct",
  "wv.acs.poverty_pct"
] as const;

export function assertReviewedWvLocalContextArtifact(
  candidate: unknown
): LocalContextArtifact {
  assertValidLocalContextArtifact(candidate);

  if (!canLoadReviewedLocalContextArtifact(candidate)) {
    throw new Error("WV local-context artifact is not eligible for reviewed runtime loading.");
  }

  if (
    candidate.manifest.artifact_version !==
    REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION
  ) {
    throw new Error(
      "Unexpected reviewed WV local-context artifact version: " +
        candidate.manifest.artifact_version
    );
  }

  if (
    candidate.manifest.national_meps_artifact_version !==
    REVIEWED_WV_LOCAL_CONTEXT_DECLARED_NATIONAL_MEPS_ARTIFACT_VERSION
  ) {
    throw new Error(
      "Reviewed WV local context is bound to an unexpected national MEPS artifact version."
    );
  }

  if (candidate.manifest.national_meps_burden_unchanged !== true) {
    throw new Error("Reviewed WV local context does not preserve the national MEPS burden boundary.");
  }

  const geography = candidate.geography;
  if (
    geography.geography_name !== "West Virginia" ||
    geography.geography_type !== "state" ||
    geography.state_fips !== "54" ||
    geography.county_fips !== null
  ) {
    throw new Error("Reviewed local context is not the exact West Virginia state geography.");
  }

  if (candidate.indicators.length !== 34) {
    throw new Error(
      "Reviewed WV local context must contain exactly 34 indicators; found " +
        candidate.indicators.length +
        "."
    );
  }

  if (
    candidate.indicators.some(
      record =>
        record.release_status !== "reviewed_released" ||
        record.geography_name !== "West Virginia" ||
        record.geography_type !== "state" ||
        record.state_fips !== "54" ||
        record.county_fips !== null
    )
  ) {
    throw new Error("Reviewed WV local-context records do not preserve release/geography invariants.");
  }

  for (const indicatorId of REQUIRED_DECISION_INDICATOR_IDS) {
    if (!candidate.indicators.some(record => record.indicator_id === indicatorId)) {
      throw new Error("Reviewed WV local context is missing required indicator " + indicatorId + ".");
    }
  }

  return candidate;
}
