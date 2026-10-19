import { useState } from "react";
import { Link } from "react-router-dom";
import { gapExamples } from "./storyboard";
import { demoDecisionEvidence, getDemoPublication } from "./demoLiterature";
import { DemoLiteratureNotice, DemoSourceCitation } from "./DemoLiteratureComponents";
import { ConceptCard, RoleLabel, ViewHeading } from "./ConceptPrimitives";
import type { ConceptBriefSnapshot } from "./conceptBrief";

const dependencies = [
  {id: "definitions", title: "Definitions & timing", question: "What exactly would be measured?", why: "Consistent definitions and observation windows are needed before measurements can be interpreted together.", checks: "Agree milestone definitions, units, inclusion criteria and time window."},
  {id: "coverage", title: "Coverage & denominators", question: "Who and where would the data represent?", why: "A count without a defined population, geography or de-duplication rule can give a misleading account of feasibility.", checks: "Confirm geography, coverage, missingness, denominators and duplicate handling."},
  {id: "stewardship", title: "Source & stewardship", question: "Who could verify safe, reliable access?", why: "A plausible data need does not establish that a suitable source exists or may be used.", checks: "Confirm source owner, aggregate availability, privacy review and authorized access."}
] as const;
export function IdentifyDataGaps({snapshot}: {snapshot: ConceptBriefSnapshot}) {
  const [decisionId, setDecisionId] = useState(gapExamples[0]!.id);
  const [dependencyId, setDependencyId] = useState<string>("definitions");
  const example = gapExamples.find(item => item.id === decisionId)!;
  const selected = dependencies.find(item => item.id === dependencyId)!;
  const illustrated = demoDecisionEvidence[example.id as keyof typeof demoDecisionEvidence];
  const publication = getDemoPublication(illustrated.sourceId);
  return <>
    <ViewHeading eyebrow="03 / Decision-to-data concept" title="Make the unknowns navigable.">Follow an example decision to the information and review it would need. This is a dependency map of questions, not a finding of missing local data or a causal model.</ViewHeading>
    <DemoLiteratureNotice />
    <fieldset className="fc-decision-picker"><legend>Choose a hypothetical decision</legend>{gapExamples.map(example => <label key={example.id}><input type="radio" name="concept-decision" checked={decisionId === example.id} onChange={() => setDecisionId(example.id)} /><span>{example.decision}</span></label>)}</fieldset>
    <div className="fc-dependency-workspace">
      <section className="fc-map" aria-label="Illustrative decision dependency map"><RoleLabel /><div className="fc-map-legend"><span>Decision</span><span>Information need</span><span>Verification dependencies</span></div>
        <div className="fc-map-canvas"><div className="fc-map-root"><span className="fc-node-type">Hypothetical decision</span><h3>{example.decision}</h3><span className="fc-node-state">Availability not assessed</span></div><span className="fc-map-link" aria-hidden="true">requires →</span><div className="fc-map-need"><span className="fc-node-type">Information to investigate</span><h3>{example.needed_information}</h3><p>{example.verification}</p></div><span className="fc-map-link" aria-hidden="true">verify →</span><div className="fc-map-branches">{dependencies.map(item => <button key={item.id} aria-pressed={dependencyId === item.id} aria-controls="fc-dependency-inspector" onClick={() => setDependencyId(item.id)}><span className="fc-dependency-dot" aria-hidden="true"/><span>{item.title}<small>Not yet assessed</small></span><span aria-hidden="true">→</span></button>)}</div></div>
        <p className="fc-map-caption">Select a verification node to inspect its purpose. Lines indicate information dependencies only.</p>
      </section>
      <ConceptCard title={selected.title} eyebrow="Dependency inspector" className="fc-inspector"><div id="fc-dependency-inspector" aria-live="polite"><h4>{selected.question}</h4><p><b>Why it matters</b></p><p>{selected.why}</p><p><b>What would be checked</b></p><p>{selected.checks}</p><p className="fc-inspector-context">For this decision: {example.needed_information}.</p></div><span className="fc-node-state">Unknown · availability not assessed</span></ConceptCard>
    </div>
    <section className="fc-demo-analysis" aria-label="Worked decision-to-data example">
      <div className="fc-section-title"><h3>An analyst-ready example, not a verified data gap</h3><span className="fc-muted">Illustrative specification · no real request created</span></div>
      <div className="fc-two-grid">
        <div className="fc-card">
          <h4>Why ask this?</h4><p>{illustrated.exampleFinding}</p>
          <h4>Operational definition to verify</h4><p>{illustrated.candidateDefinition}</p>
          <h4>Example output if data become available</h4><p>{illustrated.sampleOutput}</p>
        </div>
        <div className="fc-card"><h4>Traceable external context</h4><DemoSourceCitation source={publication} compact />
          <p className="fc-muted">This publication is not an audited record of missing local data. A data steward must verify source access, definitions and approval.</p>
        </div>
      </div>
    </section>
    <div className="fc-three-grid fc-gap-states"><section className="fc-card"><RoleLabel kind="reviewed">Current selection state</RoleLabel><h3>{snapshot.local.status === "selected" ? "Context selected" : snapshot.local.status === "unselected" ? "Context unselected" : "Context unavailable / withheld"}</h3><p>This describes the current Brief selection, not whether local data exists.</p></section><ConceptCard title="Unknown ≠ missing"><p>The illustrative information needs have not been assessed for availability. No verified local deficiency has been identified.</p></ConceptCard><ConceptCard title="Review before a request"><p>Confirm definitions, scope, ownership and privacy. An analyst decides whether to create, accept or select a real request.</p></ConceptCard></div>
    <div className="fc-action-boundary"><div><h3>Move into the trusted workflow.</h3><p>Opening Data Requests only navigates. These concept questions are not copied into analyst state.</p></div><Link className="button secondary" to="/data-requests">Open real Data Requests →</Link></div>
  </>;
}
