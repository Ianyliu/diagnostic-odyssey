import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { BRIEF_HEADLINE_IDS } from "../data/briefExecutiveHeadlines";

const HEADLINES = [
  { key: "population", title: "U.S. adults represented" },
  { key: "spending", title: "Total all-cause spending" },
  { key: "paperwork", title: "Paperwork & bills time" },
  { key: "distress", title: "Serious distress (K6 ≥ 13)" }
] as const;

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
      <header className="brief-executive-header">
        <p className="eyebrow">EXECUTIVE SUMMARY</p>
        <h2 id="brief-executive-title">Key figures</h2>
        <p className="micro-caption">National descriptive · Local terrain · Planning math — kept strictly separate.</p>
      </header>

      <div className="brief-executive-grid">
        {highlights.map(({ key, title, finding }) => (
          <article className="brief-executive-finding" key={key}>
            <h3>{title}</h3>
            <strong className="brief-executive-value">{formatEstimateValue(finding.estimate)}</strong>
            <span className="brief-executive-interval">{formatEstimateInterval(finding.estimate)}</span>
            <small>MEPS 2024 · {finding.estimate.estimate_id}</small>
          </article>
        ))}
      </div>

      {highlights.length !== HEADLINES.length && (
        <p role="status" className="subtle">
          Unverified national headlines are withheld, not imputed.
        </p>
      )}

      <div className="brief-executive-roles">
        <div>
          <strong>West Virginia terrain</strong>
          <p>{brief.local_context.length} indicators ({checkboxIncludedCount} selected{pilotOnlyCount ? "; +1 Simulate" : ""}).</p>
        </div>
        <div>
          <strong>Pilot assumptions</strong>
          <p>{brief.scenario ? "Deterministic planning math; not savings." : "No applied scenario."}</p>
        </div>
        <div>
          <strong>Data requests</strong>
          <p>{brief.data_requests.length} current · {staleRequestCount} stale excluded.</p>
        </div>
      </div>
    </section>
  );
}
