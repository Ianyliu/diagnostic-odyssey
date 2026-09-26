import {
  assertValidArtifactBundle,
  type ArtifactBundle
} from "@diagnostic-odyssey/contracts";
import reviewedArtifactJson from "../../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json";

export const REVIEWED_MEPS_ARTIFACT_VERSION =
  "meps-2024-long-covid-candidate-20260926T011343Z";

export function loadReviewedMepsArtifact(): ArtifactBundle {
  const candidate: unknown = reviewedArtifactJson;
  assertValidArtifactBundle(candidate);

  if (candidate.manifest.artifact_version !== REVIEWED_MEPS_ARTIFACT_VERSION) {
    throw new Error(
      `Unexpected reviewed MEPS artifact version: ${candidate.manifest.artifact_version}`
    );
  }

  return candidate;
}
