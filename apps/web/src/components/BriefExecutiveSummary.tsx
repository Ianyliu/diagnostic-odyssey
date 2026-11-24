import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { BRIEF_HEADLINE_IDS } from "../data/briefExecutiveHeadlines";

const HEADLINES = [
  { key: "population", title: "Represented adults (18–64)" },
  { key: "spending", title: "Total national all-cause spending" },
  { key: "paperwork", title: "Health care paperwork time" },
  { key: "distress", title: "K6 serious distress screen" }
] as const;

const integer = new Intl.NumberFormat("en-US");

interface Props {
  brief: PlanningBrief;
  national: PlanningInsightsModelV1["national"];
  checkboxSelectedIds: readonly string[];
  pilotLocalContextId: string | null;
  staleRequestCount: number;
}

export function BriefExecutiveSummary({
  brief,
  national,
  checkboxSelectedIds,
  pilotLocalContextId,
  staleRequestCount
}: Props) {
  const selectedIds = new Set(checkboxSelectedIds);
  const includedIds = new Set(brief.local_context.map(record => record.indicator_id));
  const checkboxIncludedCount = brief.local_context.filter(record =>
    selectedIds.has(record.indicator_id)
  ).length;
  const pilotOnlyCount =
    pilotLocalContextId &&
    includedIds.has(pilotLocalContextId) &&
    !selectedIds.has(pilotLocalContextId)
      ? 1
      : 0;

  const byKey = {
    population: national.context.population,
    spending: national.context.allCauseSpending,
    paperwork: national.context.paperwork,
    distress: national.context.seriousDistress
  };

  const highlights = HEADLINES.flatMap(item => {
    const finding = byKey[item.key];
    return finding && finding.estimate.estimate_id === BRIEF_HEADLINE_IDS[item.key]
      ? [{ ...item, finding }]
      : [];
  });

  return (
    <section className="brief-executive-summary" aria-labelledby="brief-executive-title">
      <header className="brief-executive-header">
        <p className="eyebrow">FOUR-QUADRANT EXECUTIVE MATRIX</p>
        <h2 id="brief-executive-title">Executive summary</h2>
      </header>

      <div className="dossier-quadrants">
        <article className="dossier-quadrant q-national">
          <div className="quadrant-head">
            <span className="eyebrow">01 · NATIONAL BURDEN</span>
            <span className="status status-reviewed">MEPS 2024</span>
          </div>
          <div className="brief-executive-grid">
            {highlights.map(({ key, title, finding }) => (
              <div className="brief-executive-finding" key={key}>
                <h3>{title}</h3>
                <strong className="brief-executive-value">
                  {formatEstimateValue(finding.estimate)}
                </strong>
                <span className="brief-executive-interval">
                  {formatEstimateInterval(finding.estimate)}
                </span>
                <small>
                  MEPS 2024 · {finding.estimate.estimate_id}
                </small>
              </div>
            ))}
          </div>
          {highlights.length !== HEADLINES.length && (
            <p role="status" className="subtle">
              Unverified national headlines are withheld, not imputed.
            </p>
          )}
          <p className="micro-caption">National descriptive · Not causal</p>
        </article>

        <article className="dossier-quadrant q-terrain">
          <div className="quadrant-head">
            <span className="eyebrow">02 · STATE TERRAIN</span>
            <span className="status status-selection">HRSA · ACS</span>
          </div>
          <strong className="quadrant-hero-stat">
            {brief.local_context.length} indicators
          </strong>
          <p className="subtle">
            {checkboxIncludedCount} from selection
            {pilotOnlyCount ? " + 1 pinned to Pilot" : ""}.
          </p>
          <p className="micro-caption">State context · Not prevalence</p>
        </article>

        <article className="dossier-quadrant q-pilot">
          <div className="quadrant-head">
            <span className="eyebrow">03 · PILOT ASSUMPTIONS</span>
            <span className="status status-assumption">Planning math</span>
          </div>
          {brief.scenario ? (
            <>
              <strong className="quadrant-hero-stat">
                {formatPlanningNumber(brief.scenario.result.reached_participants, integer)} reach
              </strong>
              <p className="subtle">
                {formatPlanningCurrency(brief.scenario.result.program_resource_requirement)} program
                budget · {formatPlanningNumber(brief.scenario.result.capacity_gap, integer)} gap
              </p>
            </>
          ) : (
            <strong className="quadrant-hero-stat">No applied scenario</strong>
          )}
          <p className="micro-caption">Planning math · Not savings</p>
        </article>

        <article className="dossier-quadrant q-gaps">
          <div className="quadrant-head">
            <span className="eyebrow">04 · EVIDENCE &amp; GAPS</span>
            <span className="status status-unavailable">Admissibility</span>
          </div>
          <strong className="quadrant-hero-stat">
            {brief.evidence.length} effect params · {brief.data_requests.length} requests
          </strong>
          <p className="subtle">
            {staleRequestCount > 0
              ? `${staleRequestCount} stale request(s) excluded until refreshed.`
              : "No admitted causal effect parameter loaded."}
          </p>
          <p className="micro-caption">Pending verification · Not ROI</p>
        </article>
      </div>
    </section>
  );
}
