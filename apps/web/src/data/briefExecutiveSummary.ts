import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";

/**
 * Curated presentation only. Never compute a new estimate, combine native
 * units, or replace an unavailable reviewed record with a candidate value.
 * All four IDs are exact published/export-eligible national MEPS estimate IDs.
 */
export const BRIEF_HEADLINE_ESTIMATE_IDS = {
  population: "meps24-current-long-covid-population",
  allCauseTotal: "meps24-gross-all-cause-spending-total",
  paperwork: "meps24-healthcare-paperwork-time-mean",
  seriousDistress: "meps24-k6-serious-distress"
} as const;

const HEADLINES = [
  {key: "population", heading: "Population represented", description: "Survey-weighted U.S. adults ages 18–64 meeting the operational current-Long-COVID definition."},
  {key: "allCauseTotal", heading: "Gross national all-cause spending", description: "Total 2024 health care spending for that population; not Long-COVID-attributable costs or potential savings."},
  {key: "paperwork", heading: "Administrative time", description: "Annualized health care paperwork and navigation time in the later ESAQ response sample."},
  {key: "seriousDistress", heading: "Serious psychological distress", description: "Later K6 screening category (score ≥13), not a psychiatric diagnosis or a Long-COVID-caused outcome."}
] as const;

export function selectBriefExecutiveHighlights(findings: readonly Estimate[]) {
  return HEADLINES.flatMap(item => {
    const record = findings.find(
      finding => finding.estimate_id === BRIEF_HEADLINE_ESTIMATE_IDS[item.key] &&
        canExportEstimate(finding)
    );
    return record ? [{heading: item.heading, description: item.description, estimate: record}] : [];
  });
}
