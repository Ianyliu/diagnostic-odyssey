import type {
  ReviewedLinkedConditionSecondaryEvidence
} from "./reviewedLinkedConditionArtifact";

export interface LinkedConditionSecondaryDisplay {
  readonly estimate: string;
  readonly interval: string;
  readonly weightedDenominator: string;
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

export function formatLinkedConditionSecondaryEvidence(
  evidence: ReviewedLinkedConditionSecondaryEvidence
): LinkedConditionSecondaryDisplay {
  return {
    estimate: percent(evidence.value),
    interval: `95% CI ${percent(evidence.intervalLow)}–${percent(evidence.intervalHigh)}`,
    weightedDenominator: evidence.support.weightedTargetDenominator.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      }
    )
  };
}
