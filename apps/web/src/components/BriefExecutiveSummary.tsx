import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { BRIEF_HEADLINE_IDS } from "../data/briefExecutiveHeadlines";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";

const resultNumber = new Intl.NumberFormat("en-US");

const HEADLINES = [
  {
    key: "population",
    title: "U.S. population represented",
    meaning: "Survey-weighted adults ages 18–64 meeting the operational current Long COVID definition."
  },
  {
    key: "spending",
    title: "Total national all-cause spending",
    meaning: "2024 health care spending for the represented population—not spending attributable to Long COVID or potential savings."
  },
  {
    key: "paperwork",
    title: "Health care paperwork time",
    meaning: "Mean annualized paperwork/navigation time among eligible later ESAQ respondents; this is a different outcome sample."
  },
  {
    key: "distress",
    title: "Serious psychological distress",
    meaning: "Share with K6 score ≥ 13 among eligible later PSAQ respondents. Nonspecific screening, not a psychiatric diagnosis."
  }
] as const;

interface Props {
  brief: PlanningBrief;
  national: PlanningInsightsModelV1["national"];
  checkboxSelectedIds: readonly string[];
  pilotLocalContextId: string | null;
  staleRequestCount: number;
}

/** Always-on human-readable executive decision memo. Strict verified records come from the
 * reviewed Brief/source identity gate; canonical JSON and scenario arithmetic are never changed. */
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

  const scenarioSummary = brief.scenario;
  const localText =
    `${brief.local_context.length} reviewed statewide WV ${brief.local_context.length === 1 ? "record" : "records"} included (` +
    `${checkboxIncludedCount} via checkboxes${pilotOnlyCount ? "; 1 extra via Use in Strategy Lab" : ""}).`;

  return (
    <section className="brief-executive-summary" aria-labelledby="brief-executive-title">
      <header className="brief-executive-header">
        <p className="eyebrow">EXECUTIVE DECISION MEMO · KNOWN · ASSUMED · UNKNOWN</p>
        <h2 id="brief-executive-title">Executive summary</h2>
        <p>
          Separates reviewed national and West Virginia evidence (Known), applied Strategy Lab pilot assumptions and arithmetic (Assumed), and unestablished intervention effects or data requests (Unknown). Neither state indicators nor planning inputs alter the national figures.
        </p>
      </header>

      <div className="brief-executive-roles" aria-label="Known, assumed, and unknown summary">
        <div className="brief-role-card is-known">
          <span className="brief-role-tag">Known · Reviewed evidence</span>
          <strong>{brief.burden_findings.length} national · {brief.local_context.length} local WV</strong>
          <p>
            {localText} HRSA shortage designations (not people) and ACS indicators inform implementation—not local Long COVID prevalence or costs.
          </p>
        </div>
        <div className="brief-role-card is-assumed">
          <span className="brief-role-tag">Assumed · Proposed pilot</span>
          {scenarioSummary ? (
            <>
              <strong>
                {formatPlanningNumber(scenarioSummary.result.reached_participants, resultNumber)} served ·{" "}
                {formatPlanningCurrency(scenarioSummary.result.program_resource_requirement)}
              </strong>
              <p>
                {formatPathwayStepLabel(scenarioSummary.input.target_pathway_step)} ({formatMechanismLabel(scenarioSummary.input.mechanism)}). Gap {formatPlanningNumber(scenarioSummary.result.capacity_gap, resultNumber)}; {formatPlanningNumber(scenarioSummary.result.difference_person_months, resultNumber)} pm exposure difference. Deterministic planning math—not observed effect or savings.
              </p>
            </>
          ) : (
            <>
              <strong>No validated applied scenario</strong>
              <p>Defaults are planning assumptions, not observed evidence.</p>
            </>
          )}
        </div>
        <div className="brief-role-card is-unknown">
          <span className="brief-role-tag">Unknown · Next checks &amp; evidence gap</span>
          <strong>
            {brief.data_requests.length} current {brief.data_requests.length === 1 ? "request" : "requests"}
            {staleRequestCount > 0 ? ` · ${staleRequestCount} stale excluded` : ""}
          </strong>
          <p>
            {brief.evidence.length === 0
              ? "No reviewed intervention-effect parameter is loaded; causal benefit, savings, and ROI remain unavailable. "
              : `${brief.evidence.length} approved evidence ${brief.evidence.length === 1 ? "record" : "records"} loaded. `}
            New requests start included but may be deselected.
          </p>
        </div>
      </div>

      <div className="brief-executive-grid">
        {highlights.map(({ key, title, meaning, finding }) => (
          <article className="brief-executive-finding" key={key}>
            <h3>{title}</h3>
            <strong className="brief-executive-value">{formatEstimateValue(finding.estimate)}</strong>
            <span className="brief-executive-interval">{formatEstimateInterval(finding.estimate)}</span>
            <p>{meaning}</p>
            <small className="brief-executive-provenance">MEPS 2024 · {finding.estimate.estimate_id} · {finding.source.source_ref}</small>
          </article>
        ))}
      </div>

      {highlights.length !== HEADLINES.length && (
        <p role="status" className="subtle">
          One or more national headlines cannot be verified against this reviewed Brief and have been withheld, not imputed. Consult the original evidence records.
        </p>
      )}

      <p className="brief-executive-boundary">
        The national figures are descriptive, not attributable to Long COVID or diagnostic delay. ESAQ and PSAQ have their own outcome-specific respondent universes. Screening is not diagnosis; no causal intervention-effect, savings or ROI claim follows.
      </p>
    </section>
  );
}
