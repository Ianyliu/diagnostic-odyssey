import type { EvidenceRecord, Scenario } from "@diagnostic-odyssey/contracts";

export interface EvidenceUseDecision {
  allowed: boolean;
  reason: string;
}

export function canDriveScenarioParameter(
  evidence: EvidenceRecord,
  scenario: Scenario
): EvidenceUseDecision {
  if (evidence.reviewer_status !== "approved") {
    return { allowed: false, reason: "Evidence has not been approved by a human reviewer." };
  }
  if (!["supported", "supported_with_bounds"].includes(evidence.admissibility_status)) {
    return { allowed: false, reason: "Admissibility does not permit quantitative scenario use." };
  }
  if (!evidence.pathway_step || evidence.pathway_step !== scenario.target_pathway_step) {
    return { allowed: false, reason: "Evidence does not support the scenario target pathway step." };
  }
  if (!evidence.target_mechanism || evidence.target_mechanism !== scenario.mechanism) {
    return { allowed: false, reason: "Evidence does not support the scenario target mechanism." };
  }
  return { allowed: true, reason: "Reviewed evidence is admissible for this bounded step/mechanism use." };
}

export function evidenceClaimLabel(record: EvidenceRecord): string {
  switch (record.admissibility_status) {
    case "supported": return "Supported";
    case "supported_with_bounds": return "Supported with bounds";
    case "limited_use": return "Limited use";
    case "insufficient": return "Insufficient evidence";
  }
}
