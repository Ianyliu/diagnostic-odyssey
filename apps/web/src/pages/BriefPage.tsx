import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";

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
    a.href=url; a.download=`${brief.artifact_version}-planning-brief.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading"><p className="eyebrow">PLANNING BRIEF</p><h1>Long COVID burden and pilot planning brief</h1><p>Browser-readable deterministic synthesis with release-filtered findings, assumptions, evidence status, data needs, and warnings.</p></header>
    <div className="brief-grid">
      <article className="card brief-content">
        <section><h2>Burden findings eligible for export</h2>{brief.burden_findings.length === 0 ? <div className="empty-state"><strong>No analytical estimate is export-eligible in this development fixture.</strong><p>Illustrative values remain visible on Burden but are deliberately excluded from export.</p></div> : brief.burden_findings.map(x=><p key={x.estimate_id}>{x.label}: {x.value}</p>)}</section>
        <section><h2>Pilot target</h2>{brief.scenario ? <><p><strong>{brief.scenario.input.target_pathway_step}</strong> via {brief.scenario.input.mechanism}</p><p>{brief.scenario.result.reached_participants.toLocaleString()} participants within capacity; {brief.scenario.result.difference_person_months.toLocaleString()} person-month planning exposure difference.</p><p>Program-resource requirement: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(brief.scenario.result.program_resource_requirement)}.</p></> : <p>No scenario selected.</p>}</section>
        <section><h2>What to collect next</h2><ul>{brief.data_requests.map(request=><li key={request.request_id}><strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}</li>)}</ul></section>
        <section><h2>Warnings</h2><ul>{brief.warnings.map(w=><li key={w}>{w}</li>)}</ul></section>
      </article>
      <aside className="card brief-aside"><h2>Decision readiness</h2><div className="readiness"><strong>Burden estimates</strong><span className="status status-fixture">Fixture only</span></div><div className="readiness"><strong>Scenario arithmetic</strong><span className="status status-ok">Working</span></div><div className="readiness"><strong>Evidence parameter</strong><span className="status status-scaffold">Insufficient</span></div><div className="readiness"><strong>Local context</strong><span className="status status-scaffold">Partial fixture</span></div><button className="button" onClick={exportJson}>Export JSON companion</button><button className="button secondary" onClick={()=>window.print()}>Print / save HTML</button></aside>
    </div>
  </section>;
}
