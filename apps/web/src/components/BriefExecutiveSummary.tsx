import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";

/** Curated reviewed IDs, not new analysis or a substitute source of estimates. */
export const BRIEF_HEADLINE_IDS = {
  population: "meps24-current-long-covid-population",
  spending: "meps24-gross-all-cause-spending-total",
  paperwork: "meps24-healthcare-paperwork-time-mean",
  distress: "meps24-k6-serious-distress"
} as const;

const HEADLINES = [
  {
    key: "population", title: "U.S. population represented",
    meaning: "Survey-weighted adults ages 18–64 meeting the operational current Long COVID definition."
  },
  {
    key: "spending", title: "Total national all-cause spending",
    meaning: "2024 health care spending for the represented population—not spending attributable to Long COVID or potential savings."
  },
  {
    key: "paperwork", title: "Health care paperwork time",
    meaning: "Mean annualized paperwork/navigation time among eligible later ESAQ respondents; this is a different outcome sample."
  },
  {
    key: "distress", title: "Serious psychological distress",
    meaning: "Share with K6 score ≥13 among eligible later PSAQ respondents. Nonspecific screening, not a psychiatric diagnosis."
  }
] as const;

interface Props {
  brief: PlanningBrief;
  national: PlanningInsightsModelV1["national"];
  checkboxSelectedIds: readonly string[];
  pilotLocalContextId: string | null;
  staleRequestCount: number;
}

/** Always-on human-readable view. Strict verified records come from the reviewed
 * Brief/source identity gate; canonical JSON and scenario are never changed. */
export function BriefExecutiveSummary({
  brief, national, checkboxSelectedIds, pilotLocalContextId, staleRequestCount
}: Props) {
  const selectedIds = new Set(checkboxSelectedIds);
  const includedIds = new Set(brief.local_context.map(record => record.indicator_id));
  const checkboxIncludedCount = brief.local_context.filter(record => selectedIds.has(record.indicator_id)).length;
  const pilotOnlyCount = pilotLocalContextId && includedIds.has(pilotLocalContextId) && !selectedIds.has(pilotLocalContextId) ? 1 : 0;
  const byKey = {
    population: national.context.population,
    spending: national.context.allCauseSpending,
    paperwork: national.context.paperwork,
    distress: national.context.seriousDistress
  };
  const highlights = HEADLINES.flatMap(item => {
    const finding = byKey[item.key];
    return finding && finding.estimate.estimate_id === BRIEF_HEADLINE_IDS[item.key]
      ? [{...item, finding}] : [];
  });
  return <section className="brief-executive-summary" aria-labelledby="brief-executive-title">
    <header className="brief-executive-header">
      <p className="eyebrow">REVIEWED NATIONAL EVIDENCE · PLANNING CONTEXT</p>
      <h2 id="brief-executive-title">Executive summary</h2>
      <p>National burden, West Virginia implementation context and analyst planning inputs have different meanings. Neither state indicators nor assumptions recalibrate the national estimates.</p>
    </header>
    <div className="brief-executive-grid">
      {highlights.map(({key, title, meaning, finding}) => <article className="brief-executive-finding" key={key}>
        <h3>{title}</h3>
        <strong className="brief-executive-value">{formatEstimateValue(finding.estimate)}</strong>
        <span className="brief-executive-interval">{formatEstimateInterval(finding.estimate)}</span>
        <p>{meaning}</p>
        <small>MEPS 2024 · {finding.estimate.estimate_id} · {finding.source.source_ref}</small>
      </article>)}
    </div>
    {highlights.length !== HEADLINES.length && <p role="status" className="subtle">One or more national headlines cannot be verified against this reviewed Brief and have been withheld, not imputed. Consult the original evidence records.</p>}
    <div className="brief-executive-roles">
      <div><strong>West Virginia implementation context</strong><p>{brief.local_context.length} reviewed records included in JSON ({checkboxIncludedCount} from current checkboxes{pilotOnlyCount ? "; 1 extra via Use in Pilot" : ""}). HRSA/Census access indicators are not West Virginia Long COVID prevalence or costs.</p></div>
      <div><strong>Applied Pilot assumptions</strong><p>{brief.scenario ? "Deterministic planning arithmetic from applied inputs; no effect or savings inferred." : "No validated applied scenario."} Defaults are assumptions, not observed evidence.</p></div>
      <div><strong>Operational data requests</strong><p>{brief.data_requests.length} current requests included; {staleRequestCount} selected stale requests excluded until refreshed. New requests start included but may be deselected.</p></div>
    </div>
    <p className="brief-executive-boundary">The national figures are descriptive, not attributable to Long COVID or diagnostic delay. ESAQ and PSAQ have their own outcome-specific respondent universes. Screening is not diagnosis; no causal intervention-effect, savings or ROI claim follows.</p>
  </section>;
}
