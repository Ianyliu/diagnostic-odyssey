import {
  LinkedConditionServiceUseFootprint,
  LinkedConditionServiceUseUnavailable
} from "../components/LinkedConditionServiceUseFootprint";
import { tryLoadReviewedLinkedConditionSecondaryEvidence } from "../data/reviewedLinkedConditionArtifact";
import { DomainPage } from "./DomainPage";

export function MedicalBurdenPage() {
  const linkedCondition = tryLoadReviewedLinkedConditionSecondaryEvidence();

  const secondaryContent =
    linkedCondition.status === "loaded" ? (
      <LinkedConditionServiceUseFootprint evidence={linkedCondition.evidence} />
    ) : (
      <LinkedConditionServiceUseUnavailable />
    );

  return (
    <DomainPage
      domainId="economic-healthcare"
      title="Economic & Healthcare"
      description="Gross all-cause spending and utilization with explicit boundaries."
      secondaryContent={secondaryContent}
    />
  );
}
