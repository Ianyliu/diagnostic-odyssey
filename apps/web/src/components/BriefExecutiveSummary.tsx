import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { BRIEF_HEADLINE_IDS } from "../data/briefExecutiveHeadlines";

const HEADLINES = [
  {
    key: "population",
    title: "Adults with Long COVID",
    meaning: "U.S. adults ages 18–64 (2024 MEPS)."
  },
  {
    key: "spending",
    title: "Total national spending",
    meaning: "All-cause spending; not attributable cost."
  },
  {
    key: "paperwork",
    title: "Paperwork & billing time",
    meaning: "Mean annualized hours (ESAQ sample)."
  },
  {
    key: "distress",
    title: "Serious distress screen",
    meaning: "K6 ≥ 13 screen; not a diagnosis."
  }
] as const;

interface Props {
  brief: PlanningBrief;
  national: PlanningInsightsModelV1["national"];
  checkboxSelectedIds: readonly string[];
  pilotLocalContextId: string | null;
  staleRequestCount: number;
}

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
      ? [{ ...item, finding }]
      : [];
  });

  return (
    <section className="brief-executive-summary" aria-labelledby="brief-executive-title">
      <div className="brief-exec-head">
        <div>
          <p className="apple-kicker">Executive Card Deck</p>
          <h2 id="brief-executive-title">National snapshot &amp; workspace state</h2>
        </div>
        <p className="micro-caption">Layers never blended</p>
      </div>

      <div className="brief-executive-grid">
        {highlights.map(({ key, title, meaning, finding }) => (
          <article className="apple-card brief-executive-finding" key={key}>
            <h3>{title}</h3>
            <strong className="brief-executive-value mono-figure">{formatEstimateValue(finding.estimate)}</strong>
            <span className="brief-executive-interval mono-figure">{formatEstimateInterval(finding.estimate)}</span>
            <p className="micro-caption">{meaning}</p>
          </article>
        ))}
      </div>

      {highlights.length !== HEADLINES.length && (
        <p role="status" className="subtle">
          One or more national headlines could not be verified and were withheld.
        </p>
      )}

      <div className="brief-executive-roles">
        <div className="apple-card brief-role-pill">
          <strong>Local terrain</strong>
          <p>
            <span className="mono-figure">{brief.local_context.length}</span> WV indicators ({checkboxIncludedCount} checked
            {pilotOnlyCount ? "; +1 Pilot" : ""}). Not local prevalence.
          </p>
        </div>
        <div className="apple-card brief-role-pill">
          <strong>Pilot assumptions</strong>
          <p>{brief.scenario ? "Deterministic arithmetic only; not savings or ROI." : "No applied scenario."}</p>
        </div>
        <div className="apple-card brief-role-pill">
          <strong>Data requests</strong>
          <p>
            <span className="mono-figure">{brief.data_requests.length}</span> included;{" "}
            <span className="mono-figure">{staleRequestCount}</span> stale excluded.
          </p>
        </div>
      </div>
    </section>
  );
}
