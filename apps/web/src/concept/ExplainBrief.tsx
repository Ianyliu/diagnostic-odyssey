import { useState } from "react";
import { Link } from "react-router-dom";
import { canDisplayDistributionSummary } from "@diagnostic-odyssey/contracts";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import { pilotInputFields } from "../data/pilotInputDraft";
import { formatAppliedAssumption } from "../pages/briefAssumptions";
import type { ConceptBriefSnapshot } from "./conceptBrief";
import { ConceptCard, RoleLabel, ViewHeading } from "./ConceptPrimitives";

export function ExplainBrief({snapshot}: {snapshot: ConceptBriefSnapshot}) {
  const {scenario, local} = snapshot;
  const [role, setRole] = useState("national");
  const roles = [
    {id: "national", title: "Describe the burden", status: snapshot.nationalStatus === "available" ? "Reviewed national findings" : "Findings withheld", explanation: "These released estimates describe the source population in native units. Gross burden is not attributable burden. No local estimate or intervention effect follows from them.", href: "/burden", action: "Inspect national evidence"},
    {id: "local", title: "Understand the setting", status: local.status === "selected" ? "Explicit context selection" : "No selected local context", explanation: "Only explicitly selected, current reviewed indicators belong to the local layer. They inform implementation; they do not modify national burden or establish local Long COVID prevalence.", href: "/local-context", action: "Inspect local context"},
    {id: "planning", title: "Examine assumptions", status: scenario ? "Applied Pilot quantities" : "No applied Pilot", explanation: "The Pilot links analyst inputs to deterministic planning quantities. It does not establish comparative effectiveness, causal benefit, savings or ROI.", href: "/pilot", action: "Inspect applied assumptions"}
  ];
  const active = roles.find(item => item.id === role)!;
  return <>
    <ViewHeading eyebrow="01 / The current evidence story" title="Start with what is known.">Read the current Brief through distinct evidence roles. These values come from the validated product; the future research question below is illustrative.</ViewHeading>
    <section className="fc-role-map" aria-label="Explore current Brief evidence roles"><div className="fc-role-map-nodes" role="group" aria-label="Evidence roles">{roles.map((item, i) => <button key={item.id} aria-pressed={role === item.id} aria-controls="fc-role-explanation" onClick={() => setRole(item.id)}><span className={`fc-role-index fc-role-index-${item.id}`}>0{i + 1}</span><span><strong>{item.title}</strong><small>{item.status}</small></span></button>)}</div><div id="fc-role-explanation" className="fc-role-explanation" aria-live="polite"><p>{active.explanation}</p><Link to={active.href}>{active.action} →</Link></div></section>
    <section className="fc-real-lane" aria-label="Current validated national Brief">
      <div className="fc-section-title"><h3>National burden, in its own units</h3><RoleLabel kind="reviewed">Current reviewed Brief</RoleLabel></div>
      <p className="fc-muted">One finding per available domain in artifact order. Descriptive highlights, with no ranking across measures.</p>
      <div className="fc-three-grid">{snapshot.highlights.map(({estimate, source, domain}) => <article className="fc-finding" key={estimate.estimate_id}>
        <p className="fc-kicker">{domain}</p><h4>{estimate.label}</h4>
        <div className="fc-value">{canDisplayDistributionSummary(estimate) ? <DistributionSummaryText estimate={estimate} /> : formatEstimateValue(estimate)}</div>
        <p className="fc-interval">{formatEstimateInterval(estimate).replace(" CI", " confidence interval")}</p>
        <p className="fc-denominator">{estimate.denominator}</p>
        <details><summary>Source & interpretation</summary><div className="fc-disclosure">
          <p>{estimate.allowed_interpretation}</p>
          <dl className="fc-facts"><div><dt>Source</dt><dd>{source.source_name} · {source.source_ref}</dd></div><div><dt>Exact locator</dt><dd>{estimate.source_locator ?? source.locator}</dd></div><div><dt>Artifact / estimate</dt><dd>{estimate.artifact_version}<br />{estimate.estimate_id}</dd></div><div><dt>Native unit / universe</dt><dd>{estimate.unit} · {estimate.universe}</dd></div><div><dt>System boundary</dt><dd>{estimate.system_boundary}</dd></div></dl>
          <ul>{[...estimate.limitations, ...estimate.prohibited_interpretation, ...source.limitations].map((limit, i) => <li key={i}>{limit}</li>)}</ul>
          {canDisplayDistributionSummary(estimate) && <p>Typical Range is the 25th–75th percentile distribution, not a confidence interval.</p>}
          <Link to="/burden">Inspect the reviewed burden →</Link>
        </div></details>
      </article>)}</div>
      {snapshot.nationalStatus === "withheld" && <p className="fc-empty">No released finding available to summarize. No substitute values are shown.</p>}
    </section>
    <div className="fc-two-grid">
      <section className="fc-card fc-local" aria-labelledby="fc-local-heading"><RoleLabel kind="reviewed">Explicit local selection</RoleLabel><h3 id="fc-local-heading">Context is a separate layer.</h3>
        {local.status === "selected" ? <>{local.records.map(record => <details key={record.indicator_id}><summary>{record.label}: {formatLocalContextValue(record)}</summary><div className="fc-disclosure"><p>{record.geography_name} · {record.universe}</p><p>Published uncertainty: {formatPublishedLocalContextUncertainty(record)}</p><p>{record.allowed_interpretation}</p><p>{record.source_agency} · {record.source_release_vintage} · {record.source_ref}</p><p>{record.source_locator}</p><p>{local.artifactVersion}</p><p>{record.limitations.join(" ")}</p></div></details>)}</> : <><p className="fc-empty">{local.status === "unselected" ? "Available, not selected" : local.status === "withheld" ? "Source identity withheld" : "Local context unavailable"}</p><p>No local disease-burden claim is inferred. Choose reviewed indicators in the existing workspace.</p></>}
        <p className="fc-muted">Local implementation context does not rescale national burden.</p><Link to="/local-context">Inspect local context →</Link>
      </section>
      <section className="fc-card fc-planning" aria-labelledby="fc-planning-heading"><RoleLabel kind="assumption">Analyst assumptions → deterministic quantities</RoleLabel><h3 id="fc-planning-heading">A planning model, with boundaries.</h3>
        {scenario ? <><div className="fc-planning-flow"><div><span>Applied assumption</span><strong>{formatPlanningNumber(scenario.input.capacity)}</strong><small>participants · program capacity</small></div><span className="fc-flow-symbol" aria-hidden="true">→</span><div><span>Deterministic result</span><strong>{formatPlanningNumber(scenario.result.reached_participants)}</strong><small>participants within capacity</small></div></div><p><b>{formatPlanningCurrency(scenario.result.program_resource_requirement)}</b> program-resource requirement. This is not savings, ROI or demonstrated benefit.</p>
          <details><summary>Inspect all applied assumptions</summary><dl className="fc-facts">{pilotInputFields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{formatAppliedAssumption(scenario.input, field)}</dd></div>)}<div><dt>Pathway / mechanism</dt><dd>{scenario.input.target_pathway_step} / {scenario.input.mechanism}</dd></div></dl></details></> : <p className="fc-empty">Apply a valid Pilot scenario before interpreting planning quantities.</p>}
        <Link to="/pilot">Inspect the assumption-based Pilot →</Link>
      </section>
    </div>
    <details className="fc-boundaries"><summary>Keep the interpretation boundaries visible</summary><ul>{snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
    <ConceptCard title="What would be worth investigating next?" eyebrow="Example follow-up question" className="fc-next-question"><p>What independently reviewed intervention evaluations would be applicable to this planning context?</p><p className="fc-muted">A future approved synthesis engine could organize that investigation. No retrieval or AI generation has happened here.</p></ConceptCard>
  </>;
}
