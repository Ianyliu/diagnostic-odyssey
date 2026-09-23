import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateValue } from "../data/formatEstimateValue";
import { PLANNING_DEFAULTS_LABEL } from "../data/planningScenarioDefaults";

export function BriefPage() {
  const {bundle,scenario,scenarioResult} = useArtifact();
  if (!bundle) return null;

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  const brief = buildPlanningBrief({
    context: bundle.context,
    estimates,
    localContext: bundle.local_context,
    scenario: scenario && scenarioResult ? {input:scenario,result:scenarioResult} : null,
    evidence: bundle.evidence,
    dataRequests: bundle.data_requests
  });

  const exportJson = () => {
    const blob = new Blob([serializeBriefJson(brief)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`${brief.artifact_version}-planning-brief.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">PLANNING BRIEF</p>
      <h1>Long COVID burden and pilot planning brief</h1>
      <p>Deterministic synthesis of reviewed national burden, analyst-supplied planning assumptions, explicit evidence gaps, and interpretation guardrails.</p>
    </header>

    <div className="brief-grid">
      <article className="card brief-content">
        <section>
          <h2>Reviewed national burden findings</h2>
          {brief.burden_findings.length === 0 ? <div className="empty-state">
            <strong>No reviewed analytical estimate is currently export-eligible.</strong>
            <p>The release/display gate remains active; no unreleased or illustrative value is substituted.</p>
          </div> : brief.burden_findings.map(x =>
            <p key={x.estimate_id}><strong>{x.label}:</strong> {formatEstimateValue(x)}</p>
          )}
        </section>

        <section>
          <h2>Pilot planning assumptions</h2>
          <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong> These inputs are planning assumptions, not observed evidence.</p>
          {brief.scenario ? <>
            <p><strong>{brief.scenario.input.target_pathway_step}</strong> via {brief.scenario.input.mechanism}</p>
            <p>{brief.scenario.result.reached_participants.toLocaleString()} participants within capacity; {brief.scenario.result.difference_person_months.toLocaleString()} person-month planning exposure difference.</p>
            <p>Program-resource requirement: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(brief.scenario.result.program_resource_requirement)}.</p>
          </> : <div className="empty-state"><strong>No valid planning scenario result is available.</strong><p>This does not alter the reviewed national burden findings.</p></div>}
        </section>

        <section>
          <h2>Local implementation context</h2>
          {brief.local_context.length > 0
            ? brief.local_context.map(x => <p key={`${x.geography}-${x.indicator}`}><strong>{x.indicator}:</strong> {x.value === null ? "Missing / not available" : String(x.value)}</p>)
            : <div className="empty-state"><strong>Local context not yet loaded.</strong><p>No local prevalence or state-specific Long COVID burden is inferred from national MEPS evidence.</p></div>}
        </section>

        <section>
          <h2>Intervention-effect evidence</h2>
          {brief.evidence.length > 0
            ? brief.evidence.map(x => <p key={x.evidence_id}><strong>{x.allowed_use}</strong> — {x.source}</p>)
            : <div className="empty-state"><strong>No reviewed intervention-effect parameter is loaded.</strong><p>Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.</p></div>}
        </section>

        <section>
          <h2>What to collect next</h2>
          {brief.data_requests.length > 0
            ? <ul>{brief.data_requests.map(request => <li key={request.request_id}><strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}</li>)}</ul>
            : <div className="empty-state"><strong>No reviewed data-request template is loaded in this analytical artifact.</strong><p>Future pilot data requests remain planning templates rather than observed evidence.</p></div>}
        </section>

        <section><h2>Warnings</h2><ul>{brief.warnings.map(w=><li key={w}>{w}</li>)}</ul></section>
      </article>

      <aside className="card brief-aside">
        <h2>Decision readiness</h2>
        <div className="readiness"><strong>Burden estimates</strong><span className="status status-ok">Reviewed national</span></div>
        <div className="readiness"><strong>Scenario arithmetic</strong><span className="status status-scaffold">Planning assumptions</span></div>
        <div className="readiness"><strong>Evidence parameter</strong><span className="status status-scaffold">Not loaded</span></div>
        <div className="readiness"><strong>Local context</strong><span className="status status-scaffold">Not loaded</span></div>
        <button className="button" onClick={exportJson}>Export JSON companion</button>
        <button className="button secondary" onClick={()=>window.print()}>Print / save PDF</button>
      </aside>
    </div>
  </section>;
}
