import { useState } from "react";
import { Link } from "react-router-dom";
import { researchTargets } from "./storyboard";
import { ConceptCard, QuestionList, TransferabilityQuestions, ViewHeading } from "./ConceptPrimitives";

const pipeline = [
  {title: "Frame a question", text: "Specify the pathway milestone, population and comparator before searching. The cards below are research targets only."},
  {title: "Review exact sources", text: "Retrieve eligible publications, verify exact locators and study designs, then obtain independent source admission. No publication is loaded here."},
  {title: "Assess applicability", text: "Review population, geography, health system and delivery conditions. Transferability and effectiveness remain unestablished."}
];
type Lens = "profile" | "transfer" | "source";
export function ExploreInterventions() {
  const [topic, setTopic] = useState("all");
  const [lens, setLens] = useState<Lens>("profile");
  const [stage, setStage] = useState(0);
  const visible = researchTargets.filter(target => topic === "all" || target.id === topic);
  return <>
    <ViewHeading eyebrow="02 / Literature investigation concept" title="Better questions before recommendations.">Explore the shape of a source-grounded investigation. No literature search has been performed; these study-card layouts contain research questions, with evidence fields intentionally unpopulated.</ViewHeading>
    <section className="fc-pipeline" aria-label="Future review workflow"><div className="fc-section-title"><h3>A future review workflow</h3><span className="fc-muted">No steps performed</span></div><div className="fc-pipeline-steps">{pipeline.map((step, i) => <button key={step.title} aria-pressed={stage === i} aria-controls="fc-pipeline-detail" onClick={() => setStage(i)}><span>0{i + 1}</span>{step.title}<span aria-hidden="true">→</span></button>)}</div><p id="fc-pipeline-detail" aria-live="polite">{pipeline[stage]!.text}</p></section>
    <div className="fc-toolbar"><label>Research topic <select aria-label="Research topic" value={topic} onChange={event => setTopic(event.target.value)}><option value="all">All research topics</option>{researchTargets.map(target => <option value={target.id} key={target.id}>{target.title}</option>)}</select></label><div className="fc-segmented" role="group" aria-label="Research review lens">{([['profile', 'Study profile'], ['transfer', 'Transferability'], ['source', 'Sources & limits']] as const).map(([id, title]) => <button key={id} aria-pressed={lens === id} onClick={() => setLens(id)}>{title}</button>)}</div></div>
    <p className="sr-only" role="status">Showing {visible.length} illustrative research topics. Review lens: {lens}.</p>
    <div className={`fc-research-grid ${visible.length === 1 ? "fc-single-topic" : ""}`}>{visible.map((target, i) => <ConceptCard title={target.title} key={target.id} eyebrow={`Research target / ${target.id}`} className="fc-study">
      <div className="fc-study-number" aria-hidden="true">0{researchTargets.indexOf(target) + 1}</div><p>{target.framing}</p>
      <div className="fc-evidence-status"><span>Source: not reviewed</span><span>Effectiveness: not established</span><span>Applicability: not evaluated</span></div>
      <div className="fc-lens-content" key={`${lens}-${i}`}>
        {lens === "profile" && <dl className="fc-facts"><div><dt>Population</dt><dd>{target.population}</dd></div><div><dt>Geography / health system</dt><dd>Not reviewed</dd></div><div><dt>Setting</dt><dd>{target.intended_setting}</dd></div><div><dt>Study design / comparator</dt><dd>{target.study_design}</dd></div><div><dt>Outcomes / evidence strength</dt><dd>{target.outcomes} / not assessed</dd></div></dl>}
        {lens === "transfer" && <TransferabilityQuestions />}
        {lens === "source" && <><dl className="fc-facts"><div><dt>Publication / citation</dt><dd>None admitted</dd></div><div><dt>DOI / exact source locator</dt><dd>Not available</dd></div><div><dt>Effect size / cost savings</dt><dd>Not established</dd></div><div><dt>Limitations</dt><dd>{target.limitations}</dd></div></dl><p className="fc-muted">No reviewed source means no conclusion about benefit, harm or absence of effect.</p></>}
      </div>
      <details><summary>Open investigation questions</summary><QuestionList questions={target.questions} /><p className="fc-muted">Illustrative questions only. A reviewer would verify each against exact source material.</p></details>
    </ConceptCard>)}</div>
    <div className="fc-action-boundary"><div><h3>Evidence enters through review.</h3><p>Publication retrieval, source admission and applicability assessment require separate approval.</p></div><Link className="button secondary" to="/evidence">Inspect actual evidence eligibility →</Link></div>
  </>;
}
