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

  return (
    <DomainPage
      domainId="economic-healthcare"
      title="Spending & healthcare use"
      description="Gross all-cause spending with 95% intervals."
      secondaryContent={secondaryContent}
    />
  );
}
