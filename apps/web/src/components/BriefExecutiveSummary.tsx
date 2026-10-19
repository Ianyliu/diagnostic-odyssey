import type {PlanningBrief} from "@diagnostic-odyssey/brief-core";
import {formatEstimateInterval, formatEstimateValue} from "../data/formatEstimateValue";
import {selectBriefExecutiveHighlights} from "../data/briefExecutiveSummary";

interface Props {
  brief: PlanningBrief;
  checkboxSelectedCount: number;
  staleRequestCount: number;
}

/** Human-readable presentation, separate from the canonical JSON Brief. */
export function BriefExecutiveSummary({brief, checkboxSelectedCount, staleRequestCount}: Props) {
  const highlights = selectBriefExecutiveHighlights(brief.burden_findings);
  const pilotOnlyContextCount = brief.local_context.length - checkboxSelectedCount;
  return <section className="brief-executive-summary" aria-labelledby="brief-executive-title">
    <div className="brief-executive-heading">
      <p className="eyebrow">EXECUTIVE SUMMARY · REVIEWED EVIDENCE + PLANNING STATE</p>
      <h2 id="brief-executive-title">What the evidence shows — and what remains a decision</h2>
      <p>National estimates describe a survey-defined population. West Virginia access indicators, pilot assumptions and requests for more information play separate roles; none recalibrates national burden.</p>
    </div>
    <div className="brief-executive-grid">
      {highlights.map(({heading, description, estimate}) => <article className="brief-executive-finding" key={estimate.estimate_id}>
        <h3>{heading}</h3>
        <strong className="brief-executive-value">{formatEstimateValue(estimate)}</strong>
        <span className="brief-executive-interval">{formatEstimateInterval(estimate)}</span>
        <p>{description}</p>
        <small>National MEPS 2024 · {estimate.estimate_id} · {estimate.source_ref}</small>
      </article>)}
    </div>
    {highlights.length < 4 && <p className="subtle" role="status">An executive headline is unavailable under the reviewed export gate; no value has been imputed. Inspect the full reviewed findings in the expanded report.</p>}
    <div className="brief-executive-roles">
      <section>
        <h3>West Virginia implementation context</h3>
        <p><strong>{brief.local_context.length} reviewed record{brief.local_context.length === 1 ? "" : "s"} included</strong> in the JSON Brief; {checkboxSelectedCount} via Local Context checkboxes{pilotOnlyContextCount > 0 ? `, and ${pilotOnlyContextCount} via the separate Use-in-Pilot choice` : ""}.</p>
        <p>Statewide HRSA/Census access context; not West Virginia Long COVID prevalence or spending. The full record list, IDs, source vintages, limitations and uncertainty remain in JSON and the optional print appendix.</p>
      </section>
      <section>
        <h3>Analyst pilot assumptions</h3>
        <p>{brief.scenario ? "A scenario with applied planning inputs and deterministic arithmetic is included. Defaults are assumptions, not evidence or proof of analyst customization." : "No valid applied planning scenario is included."}</p>
        <p>Program-resource requirements and exposure differences are not observed savings, benefits or causal effects.</p>
      </section>
      <section>
        <h3>Operational data requests</h3>
        <p><strong>{brief.data_requests.length} current request{brief.data_requests.length === 1 ? "" : "s"} included.</strong> Newly created analyst requests start selected by default and can be deselected. {staleRequestCount > 0 ? `${staleRequestCount} selected stale request(s) excluded until explicitly refreshed.` : "No selected stale request is excluded."}</p>
        <p>Requests identify evidence still needed; they are not observed findings. Full requests and provenance remain in the JSON and optional appendix.</p>
      </section>
    </div>
    <p className="brief-executive-boundary">These are descriptive 2024 estimates for an operational current-Long-COVID population, not estimates of diagnostic-delay-attributable effects. Do not sum out-of-pocket costs into gross spending or interpret K6 as a diagnosis.</p>
  </section>;
}
