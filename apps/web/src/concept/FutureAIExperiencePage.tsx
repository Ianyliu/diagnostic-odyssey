import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { conceptLabel, goals, type GoalId } from "./storyboard";
import { ConceptIcon } from "./ConceptPrimitives";
import { useConceptBrief } from "./useConceptBrief";
import { ExplainBrief } from "./ExplainBrief";
import { ExploreInterventions } from "./ExploreInterventions";
import { IdentifyDataGaps } from "./IdentifyDataGaps";
import { CompareStrategies } from "./CompareStrategies";
import "./FutureAIExperience.css";

export default function FutureAIExperiencePage() {
  const snapshot = useConceptBrief();
  const [goal, setGoal] = useState<GoalId>("explain_brief");
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % goals.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + goals.length - 1) % goals.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = goals.length - 1;
    else return;
    event.preventDefault(); setGoal(goals[next]!.id); controls.current[next]?.focus();
  }
  if (!snapshot) return null;
  return <section className="page future-concept">
    <div className="fc-banner" role="note"><ConceptIcon name="spark" size={19} /><strong>{conceptLabel}</strong><span>Demo only · No live AI</span></div>
    <header className="fc-hero"><div><div className="fc-hero-meta"><span className="fc-kicker">Diagnostic Odyssey / Future experience lab</span><Link to="/brief">Back to current Brief →</Link></div><h1>From evidence<br />to better questions<span>.</span></h1><p>A preview of how a future assistant could help you understand the Brief, structure an investigation and make uncertainty useful.</p><div className="fc-hero-legend"><span><i className="fc-dot-reviewed" />Current product evidence</span><span><i className="fc-dot-concept" />Illustrative exploration</span><span><i className="fc-dot-future" />Live AI requires approval</span></div></div><div className="fc-orbit" aria-hidden="true"><div className="fc-orbit-line"/><div className="fc-orbit-center"><ConceptIcon name="spark" size={37}/><span>Evidence<br />before inference</span></div><span className="fc-orbit-node fc-orbit-a"><ConceptIcon name="story"/>Brief</span><span className="fc-orbit-node fc-orbit-b"><ConceptIcon name="research"/>Research</span><span className="fc-orbit-node fc-orbit-c"><ConceptIcon name="map"/>Questions</span></div></header>
    <div className="fc-goal-selector" role="tablist" aria-label="Future experience goals">{goals.map((item, i) => <button role="tab" id={`fc-tab-${item.id}`} aria-controls="fc-output" aria-selected={goal === item.id} tabIndex={goal === item.id ? 0 : -1} ref={element => {controls.current[i] = element;}} key={item.id} onClick={() => setGoal(item.id)} onKeyDown={event => moveTab(event, i)}><span className="fc-tab-icon"><ConceptIcon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="fc-tab-arrow" aria-hidden="true">→</span></button>)}</div>
    <div className="fc-context-strip"><span>Context: <b>Current Planning Brief</b></span><span>National: {snapshot.nationalStatus === "available" ? "reviewed" : "withheld"}</span><span>Local: {snapshot.local.status}</span><span>Pilot: {snapshot.scenario ? "applied assumptions" : "unavailable"}</span></div>
    <div id="fc-output" role="tabpanel" tabIndex={0} aria-labelledby={`fc-tab-${goal}`}><div className="fc-output-content" key={goal}>
      {goal === "explain_brief" && <ExplainBrief snapshot={snapshot} />}
      {goal === "explore_interventions" && <ExploreInterventions />}
      {goal === "identify_data_gaps" && <IdentifyDataGaps snapshot={snapshot} />}
      {goal === "compare_strategies" && <CompareStrategies />}
    </div></div>
    <details className="fc-activation"><summary><span>What would it take to activate live AI?</span><span className="fc-kicker">Future / gated</span></summary><p>Source literature admission, an accountable reviewer, a validated output schema, provider/security/privacy approval, and human dispositions are all required. Choosing a concept goal authorizes none of these.</p><p>This local storyboard makes no provider calls, accepts no prompts, creates no Data Requests and never enters canonical Brief JSON or print.</p><p className="fc-muted">Governance continues independently in issues #68, #26 and #23. This concept does not replace the deterministic Planning Insights in PR #105.</p></details>
  </section>;
}
