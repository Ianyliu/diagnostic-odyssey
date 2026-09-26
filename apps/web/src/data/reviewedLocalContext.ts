import type { LocalContextArtifact } from "@diagnostic-odyssey/contracts";
import reviewedLocalContextJson from "../../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json" with { type: "json" };
import { REVIEWED_MEPS_ARTIFACT_VERSION } from "./reviewedArtifact";
import {
  assertReviewedWvLocalContextArtifact,
  assertReviewedWvLocalContextRuntimeCompatibility,
  REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION
} from "./reviewedLocalContextValidation";

export { REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION };

export function loadReviewedWvLocalContextArtifact(): LocalContextArtifact {
  assertReviewedWvLocalContextRuntimeCompatibility(REVIEWED_MEPS_ARTIFACT_VERSION);

  const candidate: unknown = reviewedLocalContextJson;
  return assertReviewedWvLocalContextArtifact(candidate);
}
