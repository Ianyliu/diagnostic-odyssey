import { canExportEstimate, type ArtifactBundle, type Estimate } from "@diagnostic-odyssey/contracts";

/** Only reviewed, export-eligible values from the immutable national bundle appear here. */
export interface HeadlineFindingSpec { estimateId: string; label: (estimate: Estimate) => string; }
export function formatWorkWeeks(hoursPerYear: number): string {
  const weeks = Math.round(hoursPerYear / 40 * 2) / 2;
  if (weeks < 0.5) return "less than half of a 40-hour work week";
  if (weeks === 0.5) return "about half of a 40-hour work week";
  return `about ${weeks.toLocaleString("en-US")} forty-hour work week${weeks === 1 ? "" : "s"}`;
}
export const HEADLINE_FINDINGS: readonly HeadlineFindingSpec[] = Object.freeze([
  { estimateId: "meps24-current-long-covid-population", label: () => "U.S. adults ages 18–64 reported current Long COVID symptoms in 2024" },
  { estimateId: "meps24-gross-all-cause-spending-total", label: () => "in total 2024 health care spending for this group, across all payers and all causes" },
  { estimateId: "meps24-own-medical-visit-time-mean", label: (e: Estimate) =>
    `hours a year per person at medical visits and getting prescriptions, ${typeof e.value === "number" ? formatWorkWeeks(e.value) : "a native-unit time measure"}` },
  { estimateId: "meps24-prior-approval-denied-delayed", label: () => "had insurance deny or delay a prior approval, among those who answered" },
  { estimateId: "meps24-phq2-screen-positive", label: () => "screened positive for depressive symptoms (PHQ-2; a screen, not a diagnosis)" }
]);
export function selectHeadlineFindings(bundle: ArtifactBundle): { spec: HeadlineFindingSpec; estimate: Estimate }[] {
  const byId = new Map(bundle.burden_domains.flatMap(d => d.measures).map(e => [e.estimate_id, e]));
  return HEADLINE_FINDINGS.flatMap(spec => {
    const estimate = byId.get(spec.estimateId);
    return estimate && canExportEstimate(estimate) && typeof estimate.value === "number" ? [{spec,estimate}] : [];
  });
}
