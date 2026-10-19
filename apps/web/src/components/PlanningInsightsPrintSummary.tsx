import type { PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";
import { pilotInputFields } from "../data/pilotInputDraft";
import { formatAppliedAssumption } from "../pages/briefAssumptions";

function printMarginStyles(artifactVersion: string): string {
  // Only a bounded identifier enters CSS; no free text, URLs, or provider content.
  const identity = /^[A-Za-z0-9_.:-]{1,160}$/.test(artifactVersion)
    ? JSON.stringify(artifactVersion) : '"Artifact identity unavailable"';
  return `@media print {
    .planning-brief-page .brief-print-footer { display: none !important; }
    @page {
      @bottom-left { content: "Diagnostic Odyssey"; font: 6.8pt sans-serif; color: #4b5750; }
      @bottom-center { content: ${identity}; font: 6.8pt sans-serif; color: #4b5750; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 6.8pt sans-serif; color: #4b5750; }
    }
  }`;
}

/** Deliberately excludes intervention options, investigation prompts and request proposals. */
export function PlanningInsightsPrintSummary({model}: {model: PlanningInsightsModelV1}) {
  const applied = model.scenario.applied;
  return <><style>{printMarginStyles(model.artifactVersion)}</style><section className="insights-print-summary" aria-labelledby="insights-print-title">
    <h2 id="insights-print-title">Planning insights summary</h2>
    <p>Deterministic planning preview — no live AI inference. Selected highlights; full reviewed findings, assumptions, provenance and selected requests follow in the Brief.</p>
    <section aria-labelledby="print-insight-national">
      <h3 id="print-insight-national">Reviewed national evidence</h3>
      {model.national.highlights.length ? model.national.highlights.map(({estimate, source}) => <div className="print-insight-finding" key={estimate.estimate_id}>
        <strong>{estimate.label}: {formatEstimateValue(estimate)}</strong>
        <span>{estimate.unit} · {formatEstimateInterval(estimate)}</span>
        <span>Reviewed record: {estimate.estimate_id} · Source: {source.source_ref}</span>
      </div>) : <p>{model.national.explanation}</p>}
      {model.national.highlights.length > 0 && <>
        <p className="print-insight-provenance-note">Universe: population definitions, sampling and eligibility restrictions vary by estimate. Denominator: use the matching reviewed record IDs above to inspect the complete denominator and exact source locator in the validated national artifact and Evidence view. This is a compact synopsis; the reviewed Brief below remains authoritative.</p>
        <p>{model.national.explanation}</p>
      </>}
    </section>
    <section aria-labelledby="print-insight-local">
      <h3 id="print-insight-local">Selected local implementation context</h3>
      {model.local.records.slice(0, 2).map(record => <div className="print-insight-finding" key={record.indicator_id}>
        <strong>{record.label}: {formatLocalContextValue(record)}</strong>
        <span>{record.geography_name} · {record.source_agency} · {record.source_release_vintage} · {formatPublishedLocalContextUncertainty(record)}</span>
        <span>{record.indicator_id} · {record.source_ref} · {record.source_locator}</span>
      </div>)}
      {model.local.records.length > 2 && <p>First two of {model.local.records.length} included indicators shown; the full selection remains in the JSON companion and can be printed using the detailed appendix option.</p>}
      {model.local.artifactVersion && <p><strong>Local artifact:</strong> {model.local.artifactVersion}</p>}
      <p>{model.local.explanation}</p>
    </section>
    <section className="print-insight-planning" aria-labelledby="print-insight-scenario">
      <h3 id="print-insight-scenario">Analyst assumptions and deterministic planning outputs</h3>
      {applied && <>
        <p>{formatPathwayStepLabel(applied.input.target_pathway_step)} · {formatMechanismLabel(applied.input.mechanism)} · {applied.input.scenario_id} · {applied.input.artifact_version}</p>
        <dl className="print-insight-quantities">{pilotInputFields.map(field => <div key={field.key}><dt>{field.label} (assumption)</dt><dd>{formatAppliedAssumption(applied.input, field)}</dd></div>)}</dl>
        <dl className="print-insight-quantities">
          <div><dt>Participants within capacity (result)</dt><dd>{formatPlanningNumber(applied.result.reached_participants)}</dd></div>
          <div><dt>Modeled capacity gap (result)</dt><dd>{formatPlanningNumber(applied.result.capacity_gap)}</dd></div>
          <div><dt>Person-month exposure difference (result)</dt><dd>{formatPlanningNumber(applied.result.difference_person_months)}</dd></div>
          <div><dt>Program-resource requirement (result)</dt><dd>{formatPlanningCurrency(applied.result.program_resource_requirement)}</dd></div>
        </dl>
      </>}
      <p>{model.scenario.explanation}</p>
      <h3>Interpretation boundaries</h3><ul>{model.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    </section>
  </section></>;
}
