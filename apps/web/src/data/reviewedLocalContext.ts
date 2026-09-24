import type { LocalContextArtifact } from "@diagnostic-odyssey/contracts";
import reviewedLocalContextJson from "../../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json";
import { REVIEWED_MEPS_ARTIFACT_VERSION } from "./reviewedArtifact";
import {
  assertReviewedWvLocalContextArtifact,
  REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION,
  REVIEWED_WV_LOCAL_CONTEXT_NATIONAL_MEPS_ARTIFACT_VERSION
} from "./reviewedLocalContextValidation";

export { REVIEWED_WV_LOCAL_CONTEXT_ARTIFACT_VERSION };

export function loadReviewedWvLocalContextArtifact(): LocalContextArtifact {
  if (
    REVIEWED_WV_LOCAL_CONTEXT_NATIONAL_MEPS_ARTIFACT_VERSION !==
    REVIEWED_MEPS_ARTIFACT_VERSION
  ) {
    throw new Error(
      "Reviewed WV local-context binding does not match the selected national MEPS runtime artifact."
    );
  }

  const candidate: unknown = reviewedLocalContextJson;
  return assertReviewedWvLocalContextArtifact(candidate);
}
