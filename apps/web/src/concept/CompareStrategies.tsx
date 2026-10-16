import { useState } from "react";
import { Link } from "react-router-dom";
import { strategyOptions } from "./storyboard";
import { demoTopicExamples, getDemoPublication, type DemoTopicId } from "./demoLiterature";
import { DemoLiteratureNotice, DemoSourceCitation } from "./DemoLiterature";
import { ConceptCard, QuestionList, TransferabilityQuestions, ViewHeading } from "./ConceptPrimitives";

const criteria = [
  {key: "mechanism_question", label: "Mechanism to investigate", group: "implementation"},
  {key: "operational_question", label: "Implementation requirements", group: "implementation"},
  {key: "research_requirement", label: "Evidence needed", group: "evidence"},
  {key: "effectiveness", label: "Comparative effectiveness", group: "evidence"},
  {key: "cost_effect", label: "Costs / resource effect", group: "implementation"},
  {key: "fit", label: "Local transferability", group: "evidence"}
] as const;
export function CompareStrategies() {
  const [selected, setSelected] = useState<string[]>(strategyOptions.map(option => option.id));
  const [lens, setLens] = useState("all");
  const options = strategyOptions.filter(option => selected.includes(option.id));
  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  return <>
    <ViewHeading eyebrow="04 / Qualitative comparison framework" title="Compare the work, without inventing a winner.">Put potential approaches side by side to examine implementation questions, evidence requirements and unknowns. No comparative effectiveness has been established.</ViewHeading>
    <DemoLiteratureNotice />
    <div className="fc-comparison-controls"><fieldset><legend>Approaches to compare · choose at least two</legend>{strategyOptions.map(option => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} disabled={selected.length === 2 && selected.includes(option.id)} onChange={() => toggle(option.id)} />{option.title}</label>)}</fieldset><label>Comparison lens <select aria-label="Comparison lens" value={lens} onChange={event => setLens(event.target.value)}><option value="all">All criteria</option><option value="implementation">Implementation</option><option value="evidence">Evidence & fit</option></select></label></div>
    <div className="fc-strategy-grid" style={{gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`}}>{options.map(option => <ConceptCard key={option.id} title={option.title} eyebrow="Potential approach / evidence not assessed" className="fc-strategy"><p>{option.mechanism_question}</p><div className="fc-demo-insight"><strong>Example evidence interpretation</strong><p>{demoTopicExamples[option.id as DemoTopicId].sampleSynthesis}</p></div><p className="fc-muted"><strong>Directness:</strong> {demoTopicExamples[option.id as DemoTopicId].directness}</p><QuestionList questions={[option.operational_question]} />
      <details><summary>Inspect an external publication</summary><DemoSourceCitation source={getDemoPublication(demoTopicExamples[option.id as DemoTopicId].sourceIds[0]!)} /></details><div className="fc-evidence-status"><span>Effectiveness: not established</span><span>Cost effect: not established</span><span>Applicability: not evaluated</span></div><details><summary>Inspect transferability questions</summary><TransferabilityQuestions /></details></ConceptCard>)}</div>
    <section className="fc-comparison" aria-label="Qualitative comparison"><div className="fc-section-title"><h3>What would need to be established?</h3><span className="fc-muted">Framework only · no scores or ranking</span></div><div className="fc-table-wrap" tabIndex={0} role="region" aria-label="Scrollable strategy comparison"><table><caption>Illustrative / not source-verified. {lens === "all" ? "All comparison criteria" : lens === "evidence" ? "Evidence and fit criteria" : "Implementation criteria"}.</caption><thead><tr><th scope="col">Decision criterion</th>{options.map(option => <th scope="col" key={option.id}>{option.title}</th>)}</tr></thead><tbody>{criteria.filter(row => lens === "all" || row.group === lens).map(row => <tr key={row.key}><th scope="row">{row.label}</th>{options.map(option => <td key={option.id}>{row.key === "effectiveness" ? <span className="fc-unknown">No matched comparative estimate</span> : row.key === "cost_effect" ? <span className="fc-unknown">Not measured for this strategy</span> : row.key === "fit" ? <span className="fc-unknown">Not evaluated for local Pilot</span> : row.key === "research_requirement" ? <>{option.research_requirement}. <span className="fc-muted">{demoTopicExamples[option.id as DemoTopicId].appraisal}</span></> : option[row.key]}</td>)}</tr>)}</tbody></table></div></section>
    <section className="fc-demo-analysis" aria-label="Example comparative interpretation">
      <h3>What would a research-aware comparison conclude today?</h3>
      <p><strong>Not a winner.</strong> The linked examples use different designs, populations and outcomes. Access studies and consensus papers can motivate care-pathway questions but cannot estimate effects. The REGAIN trial studied post-hospital online rehabilitation, not diagnostic navigation. No common comparator, cost estimand or transportability model supports ranking the strategies.</p>
      <p className="fc-muted">A future approved synthesis would grade source eligibility and directness before attempting comparisons. The current Pilot remains strictly assumption-based.</p>
    </section>
    <div className="fc-action-boundary"><div><h3>Keep exploration separate from modeled effects.</h3><p>These approaches do not populate the Pilot. Costs, effects and fit would require independently reviewed evidence.</p></div><Link className="button secondary" to="/pilot">Return to assumption-based Pilot →</Link></div>
  </>;
}
