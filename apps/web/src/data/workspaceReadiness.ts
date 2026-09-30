import type { EvidenceRecord, Scenario } from "@diagnostic-odyssey/contracts";
import { canDriveScenarioParameter } from "@diagnostic-odyssey/evidence-core";

export function getNationalBurdenReadiness(releasedCount: number) {
  return releasedCount > 0
    ? { railStatus: "Reviewed", briefStatus: "Reviewed national", tone: "reviewed" as const }
    : { railStatus: "No released estimates", briefStatus: "No released findings", tone: "unavailable" as const };
}

export function getEvidenceParameterReadiness(
  evidence: readonly EvidenceRecord[],
  appliedScenario: Scenario | null
) {
  const approved = evidence.filter(record => record.reviewer_status === "approved");
  if (approved.length === 0) {
    return { status: "No approved record loaded", tone: "unavailable" as const };
  }
  if (!appliedScenario) {
    return { status: `${approved.length} approved; scenario not checked`, tone: "neutral" as const };
  }
  const eligibleCount = approved.filter(record =>
    canDriveScenarioParameter(record, appliedScenario).allowed
  ).length;
  return eligibleCount > 0
    ? { status: `${eligibleCount} eligible for bounded use`, tone: "neutral" as const }
    : { status: "No eligible record for this scenario", tone: "unavailable" as const };
}
