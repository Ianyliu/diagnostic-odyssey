import {
  LinkedConditionServiceUseFootprint,
  LinkedConditionServiceUseUnavailable
} from "../components/LinkedConditionServiceUseFootprint";
import {
  tryLoadReviewedLinkedConditionSecondaryEvidence
} from "../data/reviewedLinkedConditionArtifact";
import { DomainPage } from "./DomainPage";

export function MedicalBurdenPage() {
  const linkedCondition = tryLoadReviewedLinkedConditionSecondaryEvidence();

  const secondaryContent = linkedCondition.status === "loaded"
    ? <LinkedConditionServiceUseFootprint evidence={linkedCondition.evidence} />
    : <LinkedConditionServiceUseUnavailable />;

  return <DomainPage
    domainId="economic-healthcare"
    title="Economic / healthcare burden"
    description="Gross all-cause burden with explicit boundaries and release state."
    secondaryContent={secondaryContent}
  />;
}
