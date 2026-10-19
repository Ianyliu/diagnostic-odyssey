import { useState } from "react";
import { Link } from "react-router-dom";
import { researchTargets } from "./storyboard";
import { DemoBibliography, DemoLiteratureNotice, DemoSourceCitation, DemoSourceList } from "./DemoLiteratureComponents";
import { demoTopicExamples, getDemoPublication, type DemoTopicId } from "./demoLiterature";
import { ConceptCard, QuestionList, TransferabilityQuestions, ViewHeading } from "./ConceptPrimitives";

const pipeline = [
  {title: "Frame a question", text: "Choose a target pathway and comparator. The examples below map actual publications to questions, not recommendations."},
  {title: "Review exact sources", text: "These sample publications have links and design details for inspection. No publication is admitted into the reviewed evidence registry; independent eligibility review remains required."},
  {title: "Assess applicability", text: "Compare reported populations, health systems, pathways and follow-up against the intended pilot. Neither local transferability nor preventable cost is established."}
];
type Lens = "profile" | "transfer" | "source";
export function ExploreInterventions() {
  const [topic, setTopic] = useState("all");
  const [lens, setLens] = useState<Lens>("profile");
  const [stage, setStage] = useState(0);
  const visible = researchTargets.filter(target => topic === "all" || target.id === topic);
  return <>
    <ViewHeading eyebrow="02 / Worked literature investigation" title="See how a source-grounded review might read.">
      A static, researched example connects real publications to three possible planning questions. Each card distinguishes what the paper actually studied from what we still need to know. No live search or model ran.
    </ViewHeading>
    <DemoLiteratureNotice />
    <section className="fc-pipeline" aria-label="Example appraisal workflow"><div className="fc-section-title"><h3>From publication to research question</h3><span className="fc-muted">Worked example · no source admitted</span></div><div className="fc-pipeline-steps">{pipeline.map((step, i) => <button key={step.title} aria-pressed={stage === i} aria-controls="fc-pipeline-detail" onClick={() => setStage(i)}><span>0{i + 1}</span>{step.title}<span aria-hidden="true">→</span></button>)}</div><p id="fc-pipeline-detail" aria-live="polite">{pipeline[stage]!.text}</p></section>
    <div className="fc-toolbar"><label>Research topic <select aria-label="Research topic" value={topic} onChange={event => setTopic(event.target.value)}><option value="all">All research topics</option>{researchTargets.map(target => <option value={target.id} key={target.id}>{target.title}</option>)}</select></label><div className="fc-segmented" role="group" aria-label="Research review lens">{([["profile", "Study profile"], ["transfer", "Transferability"], ["source", "Sources & limits"]] as const).map(([id, title]) => <button key={id} aria-pressed={lens === id} onClick={() => setLens(id)}>{title}</button>)}</div></div>
    <p className="sr-only" role="status">Showing {visible.length} illustrative research topics. Review lens: {lens}.</p>
    <div className={`fc-research-grid ${visible.length === 1 ? "fc-single-topic" : ""}`}>{visible.map((target, i) => {
      const example = demoTopicExamples[target.id as DemoTopicId];
      return <ConceptCard title={target.title} key={target.id} eyebrow={`Worked research target / 0${researchTargets.indexOf(target) + 1}`} className="fc-study">
        <div className="fc-study-number" aria-hidden="true">0{researchTargets.indexOf(target) + 1}</div>
        <p>{target.framing}</p>
        <div className="fc-demo-insight"><strong>Example synthesis</strong><p>{example.sampleSynthesis}</p></div>
        <div className="fc-evidence-status"><span>External sources linked</span><span>Effect for proposed strategy: not established</span><span>Local applicability: not evaluated</span></div>
        <div className="fc-lens-content" key={`${lens}-${i}`}>
          {lens === "profile" && <dl className="fc-facts">
            <div><dt>Sample publications</dt><dd>{example.sourceIds.map(id => id.replace(/-20\d\d$/, "")).join(" · ")}</dd></div>
            <div><dt>Study-to-question match</dt><dd>{example.directness}</dd></div>
            <div><dt>Potential local analysis</dt><dd>{example.localTranslation}</dd></div>
            <div><dt>Candidate data fields</dt><dd>{example.candidateFields.join(", ")}</dd></div>
          </dl>}
          {lens === "profile" && <div className="fc-demo-profile-source"><h4>Example published source</h4><DemoSourceCitation compact source={getDemoPublication(example.sourceIds[0]!)} /></div>}
          {lens === "transfer" && <><p>{example.appraisal}</p><TransferabilityQuestions /></>}
          {lens === "source" && <><p><strong>Product evidence status:</strong> None admitted. Source links below are demonstration research, not reviewer-approved claims.</p><DemoSourceList sourceIds={example.sourceIds} /></>}
        </div>
        <details><summary>Questions for an independent reviewer</summary><QuestionList questions={target.questions} /><p className="fc-muted">The sample synthesis is not a recommendation or an authorized data request.</p></details>
      </ConceptCard>;
    })}</div>
    <DemoBibliography />
    <div className="fc-action-boundary"><div><h3>Literature can frame a test. It cannot skip admission.</h3><p>Published designs and findings are shown for a realistic preview. Reviewed evidence, comparative effects and cost parameters remain subject to a separate governance process.</p></div><Link className="button secondary" to="/evidence">Inspect actual evidence eligibility →</Link></div>
  </>;
}
