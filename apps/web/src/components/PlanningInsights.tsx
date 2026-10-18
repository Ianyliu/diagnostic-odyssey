import { useState } from "react";
import { Link } from "react-router-dom";
import type { InsightFinding, InsightRole, PlanningInsightsModelV1 } from "../data/planningInsights";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";
import { PLANNING_DEFAULTS_LABEL } from "../data/planningScenarioDefaults";
import { pilotInputFields } from "../data/pilotInputDraft";
import { formatAppliedAssumption } from "../pages/briefAssumptions";
import { DistributionSummaryText } from "./DistributionSummaryText";
import { WorkspaceDisclosure } from "./WorkspaceDisclosure";
import { PlanningInsightsPrintSummary } from "./PlanningInsightsPrintSummary";
import "./PlanningInsights.css";

const numbers = new Intl.NumberFormat("en-US", {maximumFractionDigits: 2});
const roles: Record<InsightRole, string> = {
  reviewed: "Reviewed national evidence", context: "Selected local context",
  assumption: "Analyst assumption", result: "Deterministic result", prompt: "Planning prompt"
};

export function InsightRoleBadge({role}: {role: InsightRole}) {
  return <span className={`insight-role insight-role-${role}`}><span aria-hidden="true" />{roles[role]}</span>;
}

function PlanningQuantity({value, currency = false}: {value: number; currency?: boolean}) {
  const label = currency ? formatPlanningCurrency(value) : formatPlanningNumber(value, numbers);
  return <span className={label.includes("e+") ? "insight-scientific-value" : undefined}>{label}</span>;
}

function FindingDetails({finding}: {finding: InsightFinding}) {
  const {estimate, source} = finding;
  return <details className="insight-disclosure">
    <summary>Source, uncertainty &amp; interpretation</summary>
    <dl className="insight-provenance">
      <div><dt>Allowed interpretation</dt><dd>{estimate.allowed_interpretation}</dd></div>
      <div><dt>Population / universe</dt><dd>{estimate.universe}</dd></div>
      <div><dt>Denominator</dt><dd>{estimate.denominator}</dd></div>
      <div><dt>Native unit</dt><dd>{estimate.unit}</dd></div>
      <div><dt>Source</dt><dd><a href={source.official_url} target="_blank" rel="noreferrer">{source.source_name} <span className="sr-only">(opens in a new tab)</span></a></dd></div>
      <div><dt>Exact locator</dt><dd>{estimate.source_locator ?? source.locator}</dd></div>
      <div><dt>Record / source ID</dt><dd>{estimate.estimate_id} · {estimate.source_ref}</dd></div>
      <div><dt>Artifact version</dt><dd>{estimate.artifact_version}</dd></div>
      <div><dt>System boundary</dt><dd>{estimate.system_boundary}</dd></div>
    </dl>
    {estimate.distribution_summary && <><DistributionSummaryText estimate={estimate} /><p>Typical Range is descriptive; it is not a confidence interval.</p></>}
    {estimate.limitations.length > 0 && <p><strong>Limitations:</strong> {estimate.limitations.join(" ")}</p>}
    {estimate.prohibited_interpretation.length > 0 && <p><strong>Not supported:</strong> {estimate.prohibited_interpretation.join("; ")}</p>}
  </details>;
}

/** No candidate catalog or admission interface exists on this rendering surface. */
export function InterventionEvidenceGap({id = "intervention-options", explanation}: {id?: string; explanation?: string}) {
  return <section className="insight-panel intervention-gap" aria-labelledby={`${id}-title`}>
    <div className="insight-panel-heading">
      <span className="insight-symbol" aria-hidden="true">◇</span>
      <div><p className="visual-kicker">OPTIONS TO INVESTIGATE</p><h2 id={`${id}-title`}>Insufficient reviewed intervention evidence</h2></div>
    </div>
    <p>{explanation ?? "No independently released, context-applicable narrative intervention reference is available. This does not establish that an intervention has no effect."}</p>
    <div className="intervention-admission" role="group" aria-label="Intervention option admission requirements">
      <span>Exact source</span><span>Independent review</span><span>Context fit</span><span>Released reference</span>
    </div>
    <p className="insight-caption">A useful option needs a verifiable source and an explicit account of what transfers to your setting.</p>
    <details className="insight-disclosure">
      <summary>What would allow an option to appear?</summary>
      <ol className="intervention-requirements">
        <li><strong>Intervention and setting</strong><span>The underlying problem, population, geography, delivery mechanism, and study design.</span></li>
        <li><strong>Traceable source</strong><span>A citation, DOI/PMCID or URL, exact source passage, and retained source bytes.</span></li>
        <li><strong>Reviewed interpretation</strong><span>Approved wording, evidence limitations, prohibited stronger claims, and independently assessed applicability.</span></li>
        <li><strong>Independent release</strong><span>An immutable released reference and exact-context admission. A valid schema or candidate is not approval.</span></li>
      </ol>
      <p>Narrative references cannot supply scenario effects. Quantitative effectiveness, savings, and ROI require separate evidence and authorization.</p>
    </details>
    <Link className="text-button" to="/evidence">Inspect current evidence boundaries →</Link>
  </section>;
}

function EvidenceRoles({model}: {model: PlanningInsightsModelV1}) {
  const steps: {role: InsightRole; title: string; detail: string; href: string}[] = [
    {role: "reviewed", title: "National evidence", detail: model.national.availability === "available" ? `${model.national.findingsCount} reviewed findings` : "Reviewed summary unavailable", href: "#brief-national-burden"},
    {role: "context", title: "Local context", detail: model.local.records.length ? `${model.local.records.length} explicitly selected` : "No verified selection", href: "#brief-local-context"},
    {role: "assumption", title: "Analyst assumptions", detail: model.scenario.applied ? "Applied Pilot inputs" : "No valid applied scenario", href: "#brief-pilot-assumptions"},
    {role: "result", title: "Planning outputs", detail: model.scenario.applied ? "Deterministic arithmetic" : "Outputs unavailable", href: model.scenario.applied ? "#brief-scenario-outputs" : "/pilot"},
    {role: "prompt", title: "Operational decisions", detail: "Analyst judgment & verification", href: "/data-requests"}
  ];
  return <section className="insight-roles" aria-labelledby="insight-roles-title">
    <div className="insight-roles-heading"><h3 id="insight-roles-title">Follow the origin of a decision</h3><span>No black-box blending</span></div>
    <ol>{steps.map(step => <li key={step.role} className={`insight-stage insight-stage-${step.role}`}>
      <Link to={step.href}><strong>{step.title}</strong><span>{step.detail}</span></Link>
    </li>)}</ol>
    <p className="insight-caption">A conceptual planning relationship, not a causal chain. Selected context informs implementation; it does not statistically modify national burden.</p>
  </section>;
}

function Investigations({model}: {model: PlanningInsightsModelV1}) {
  return <section id="planning-investigations" className="insight-investigations" aria-labelledby="planning-investigations-title">
    <header className="insight-section-heading"><div><p className="visual-kicker">DATA GAPS &amp; NEXT ACTIONS</p><h2 id="planning-investigations-title">Choose what to verify next</h2></div><InsightRoleBadge role="prompt" /></header>
    <p className="insight-caption">{model.investigations.explanation}</p>
    {model.investigations.prompts.length ? <div className="investigation-grid">
      {model.investigations.prompts.map(prompt => <article className="investigation-card" key={prompt.field}>
        <div className="investigation-status"><span>{model.investigations.capacitySignal && prompt.field === "capacity" ? "Modeled constraint to verify" : "Assumption to investigate"}</span><span>{prompt.status === "absent" ? "Not created" : prompt.status === "stale" ? "Stale request" : "Request exists"}</span></div>
        <h3>{prompt.label}</h3>
        <p>{prompt.basis}</p>
        <details className="insight-disclosure">
          <summary>What to request &amp; how to interpret it</summary>
          <dl className="insight-provenance">
            <div><dt>Question</dt><dd>{prompt.request.target_question}</dd></div>
            <div><dt>Pathway / mechanism</dt><dd>{formatPathwayStepLabel(prompt.request.pathway_step)} · {formatMechanismLabel(prompt.request.target_mechanism ?? "")}</dd></div>
            <div><dt>Data that would help</dt><dd>{prompt.request.fields_needed.join(", ")}</dd></div>
            <div><dt>Possible source owner</dt><dd>{prompt.request.likely_source_owner}. Availability in any particular system is unverified.</dd></div>
            <div><dt>Granularity / time window</dt><dd>{prompt.request.granularity_time_window}</dd></div>
            <div><dt>Feasibility / privacy</dt><dd>{prompt.request.feasibility_privacy_notes}</dd></div>
            <div><dt>Existing template</dt><dd>{prompt.request.request_id}</dd></div>
          </dl>
          <p>These are operational verification prompts, not measured local data deficiencies. Reviewed acquisition mappings are currently unavailable.</p>
        </details>
        <Link className="text-button" to={prompt.href}>{prompt.actionLabel} →</Link>
      </article>)}
    </div> : <div className="insight-unavailable"><strong>No eligible request template</strong><Link to="/data-requests">Review Data Requests</Link></div>}
    <p className="insight-caption">Viewing a prompt creates nothing. Create or refresh a request explicitly in the existing workflow, then select “Include in Planning Brief” separately.</p>
  </section>;
}

export function PlanningInsights({model}: {model: PlanningInsightsModelV1}) {
  const [expanded, setExpanded] = useState(true);
  const [includePrintSummary, setIncludePrintSummary] = useState(false);
  const applied = model.scenario.applied;
  return <><section id="planning-insights" className="planning-insights" aria-labelledby="planning-insights-title">
    <header className="insights-heading">
      <div><p className="visual-kicker">AT A GLANCE</p><h2 id="planning-insights-title">Your current planning picture</h2><p className="insight-caption">Deterministic planning preview — no live AI inference.</p></div>
      <button type="button" className="text-button" aria-expanded={expanded} aria-controls="planning-insights-content" onClick={() => setExpanded(value => !value)}>{expanded ? "Hide insights" : "Show insights"}</button>
    </header>
    <label className="insights-print-choice"><input type="checkbox" checked={includePrintSummary} onChange={event => setIncludePrintSummary(event.target.checked)} /><span>Include insights summary in printed Brief<small>Reviewed findings and applied assumptions; investigation prompts stay on screen.</small></span></label>
    <div id="planning-insights-content" hidden={!expanded}>
      <div className="insight-summary-grid">
        <section className="insight-card insight-national" aria-labelledby="insight-national-title">
          <InsightRoleBadge role="reviewed" /><h3 id="insight-national-title">What the reviewed evidence describes</h3>
          {model.national.highlights.length ? <div className="insight-findings">
            {model.national.highlights.map(finding => <article className="insight-finding" key={finding.estimate.estimate_id}>
              <p className="insight-domain">{finding.domainLabel}</p>
              <h4>{finding.estimate.label}</h4>
              <strong className="insight-value">{formatEstimateValue(finding.estimate)}</strong>
              <span className="insight-uncertainty">{formatEstimateInterval(finding.estimate)}<span className="sr-only"> (CI means confidence interval)</span></span>
              <FindingDetails finding={finding} />
            </article>)}
          </div> : <p>{model.national.explanation}</p>}
          {model.national.highlights.length > 0 && <p className="insight-caption">{model.national.explanation} <Link to="#brief-national-burden">Inspect all {model.national.findingsCount} findings →</Link></p>}
        </section>

        <section className="insight-card insight-local" aria-labelledby="insight-local-title">
          <InsightRoleBadge role="context" /><h3 id="insight-local-title">Implementation context stays separate</h3>
          {model.local.records.length ? <>
            <p className="insight-local-count">{model.local.records.length} <span>selected indicator{model.local.records.length === 1 ? "" : "s"}</span></p>
            <dl className="insight-local-values">{model.local.records.slice(0, 2).map(record => <div key={record.indicator_id}><dt>{record.label}</dt><dd>{formatLocalContextValue(record)}</dd><dd className="insight-caption">{record.geography_name} · {record.source_agency} · {record.source_release_vintage}</dd></div>)}</dl>
            <details className="insight-disclosure"><summary>Selected context &amp; provenance</summary>{model.local.records.map(record => <div key={record.indicator_id} className="insight-context-detail">
              <strong>{record.label}: {formatLocalContextValue(record)}</strong><p>{formatPublishedLocalContextUncertainty(record)}</p><p>{record.allowed_interpretation}</p><p><strong>Universe:</strong> {record.universe}</p><p><strong>Source / locator:</strong> {record.source_ref} · {record.source_locator}</p><p><strong>Record:</strong> {record.indicator_id}</p><p><strong>Limitations:</strong> {record.limitations.join(" ")}</p>
            </div>)}<p><strong>Artifact:</strong> {model.local.artifactVersion}</p></details>
          </> : <strong className="insight-empty-label">{model.local.availability === "unselected" ? "Available, not selected" : "Context unavailable"}</strong>}
          <p className="insight-caption">{model.local.explanation}</p><Link className="text-button" to="/local-context">Review Local Context →</Link>
        </section>

        <section className="insight-card insight-scenario" aria-labelledby="insight-scenario-title">
          <InsightRoleBadge role="result" /><h3 id="insight-scenario-title">What the applied assumptions imply</h3>
          {applied ? <>
            <p className="insight-caption">{formatPathwayStepLabel(applied.input.target_pathway_step)} · {formatMechanismLabel(applied.input.mechanism)}</p>
            <dl className="insight-results">
              <div><dt>Participants within capacity</dt><dd><PlanningQuantity value={applied.result.reached_participants} /></dd></div>
              <div><dt>Modeled capacity gap</dt><dd><PlanningQuantity value={applied.result.capacity_gap} /></dd></div>
              <div><dt>Program-resource requirement</dt><dd><PlanningQuantity value={applied.result.program_resource_requirement} currency /></dd></div>
            </dl>
            <details className="insight-disclosure"><summary>Applied assumptions &amp; exposure difference</summary>
              <InsightRoleBadge role="assumption" /><p>{PLANNING_DEFAULTS_LABEL}. Inputs remain planning assumptions, not observed evidence.</p>
              <dl className="insight-provenance">{pilotInputFields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{formatAppliedAssumption(applied.input, field)}</dd></div>)}
                <div><dt>Person-month planning exposure difference</dt><dd>{formatPlanningNumber(applied.result.difference_person_months, numbers)}</dd></div>
                <div><dt>Scenario / assumption version</dt><dd>{applied.input.scenario_id} · {applied.input.artifact_version}</dd></div>
              </dl><p>Exposure differences reflect the chosen planning windows, not an observed improvement or predicted intervention effect.</p>
            </details>
          </> : <strong className="insight-empty-label">No valid applied result</strong>}
          <p className="insight-caption">{model.scenario.explanation}</p><Link className="text-button" to="/pilot">Inspect Pilot assumptions →</Link>
        </section>

        <section className="insight-card insight-next" aria-labelledby="insight-next-title">
          <InsightRoleBadge role="prompt" /><h3 id="insight-next-title">{model.investigations.capacitySignal ? "Check the modeled capacity constraint" : "Choose an assumption to verify"}</h3>
          <p>{model.investigations.capacitySignal ? "The applied scenario has more intended participants than capacity. Local operational information could test that assumption." : model.investigations.prompts.length ? "Reach, capacity, and timing need operational judgment. The current evidence does not establish which investigation should come first." : model.investigations.explanation}</p>
          <p className="insight-caption">A planning prompt, not an empirically established priority.</p>
          <Link className="text-button" to="#planning-investigations">Explore available next actions →</Link>
        </section>

        <section className="insight-card insight-boundaries" aria-labelledby="insight-boundaries-title">
          <div><p className="visual-kicker">INTERPRETATION BOUNDARY</p><h3 id="insight-boundaries-title">A planning picture, with uncertainty intact</h3></div>
          <p>Gross burden is not illness-attributable or diagnostic-delay-caused burden. Program resources are requirements, not savings or ROI.</p>
          <details className="insight-disclosure"><summary>Inspect all Brief warnings</summary><ul>{model.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
        </section>
      </div>
      <div className="insight-readiness">
        <strong>Intervention evidence readiness</strong>
        <p>{model.interventions.explanation}</p>
        <Link className="text-button" to="/evidence">Review intervention evidence &amp; limits →</Link>
      </div>
      <WorkspaceDisclosure id="insight-provenance-details" title="Evidence roles & provenance">
        <EvidenceRoles model={model} />
        <InterventionEvidenceGap explanation={model.interventions.explanation} />
      </WorkspaceDisclosure>
      <WorkspaceDisclosure id="insight-investigation-details" title="Explore data gaps & next actions" summary={`${model.investigations.prompts.length} operational investigation prompts · creating a request and including it in the Brief remain separate choices.`}>
        <Investigations model={model} />
      </WorkspaceDisclosure>
    </div>
  </section>{includePrintSummary && <PlanningInsightsPrintSummary model={model} />}</>;
}
