import { canExportEstimate, type ArtifactBundle, type Estimate } from "@diagnostic-odyssey/contracts";

/** Only reviewed, export-eligible values from the immutable national bundle appear here. */
export interface HeadlineFindingSpec { estimateId: string; label: (estimate: Estimate) => string; }
export const HEADLINE_FINDINGS: readonly HeadlineFindingSpec[] = Object.freeze([
  { estimateId: "meps24-current-long-covid-population", label: () => "U.S. adults ages 18–64 reported current Long COVID symptoms in 2024" },
  { estimateId: "meps24-gross-all-cause-spending-total", label: () => "in total 2024 health care spending for this group, across all payers and all causes" },
  { estimateId: "meps24-medical-bills-insurance-time-mean", label: () => "hours per person annually managing medical bills and insurance; time burden, not a dollar cost" },
  { estimateId: "meps24-k6-serious-distress", label: () => "met the K6 threshold for serious nonspecific psychological distress (a screen, not a diagnosis)" }
]);
export function selectHeadlineFindings(bundle: ArtifactBundle): { spec: HeadlineFindingSpec; estimate: Estimate }[] {
  const byId = new Map(bundle.burden_domains.flatMap(d => d.measures).map(e => [e.estimate_id, e]));
  return HEADLINE_FINDINGS.flatMap(spec => {
    const estimate = byId.get(spec.estimateId);
    return estimate && canExportEstimate(estimate) && typeof estimate.value === "number" ? [{spec,estimate}] : [];
  });
}
