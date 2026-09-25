import type { BurdenDomain, Estimate } from "@diagnostic-odyssey/contracts";

export interface BriefBurdenPresentationGroup {
  group_id: string;
  label: string;
  findings: Estimate[];
  limitations: string[];
}

export const OTHER_REVIEWED_FINDINGS_GROUP_ID = "other-reviewed-findings";

export function groupBriefBurdenFindings(
  domains: BurdenDomain[],
  findings: Estimate[]
): BriefBurdenPresentationGroup[] {
  const findingById = new Map(
    findings.map(finding => [finding.estimate_id, finding])
  );
  const assigned = new Set<string>();
  const groups: BriefBurdenPresentationGroup[] = [];

  for (const domain of domains) {
    const domainFindings: Estimate[] = [];

    for (const measure of domain.measures) {
      const finding = findingById.get(measure.estimate_id);
      if (!finding || assigned.has(finding.estimate_id)) continue;
      assigned.add(finding.estimate_id);
      domainFindings.push(finding);
    }

    if (domainFindings.length > 0) {
      groups.push({
        group_id: domain.domain_id,
        label: domain.label,
        findings: domainFindings,
        limitations: domain.limitations
      });
    }
  }

  const unmatched = findings.filter(
    finding => !assigned.has(finding.estimate_id)
  );

  if (unmatched.length > 0) {
    groups.push({
      group_id: OTHER_REVIEWED_FINDINGS_GROUP_ID,
      label: "Other reviewed findings",
      findings: unmatched,
      limitations: []
    });
  }

  return groups;
}
