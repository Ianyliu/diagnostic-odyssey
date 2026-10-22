import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { conceptLabel, goals, type GoalId } from "./storyboard";
import { ConceptIcon } from "./ConceptPrimitives";
import { useConceptBrief } from "./useConceptBrief";
import { ExplainBrief } from "./ExplainBrief";
import { ExploreInterventions } from "./ExploreInterventions";
import { IdentifyDataGaps } from "./IdentifyDataGaps";
import { CompareStrategies } from "./CompareStrategies";
import { ConceptLiveSummary } from "./ConceptLiveSummary";
import { AiGeminiPanel, type ReviewedGeminiResponse } from "../components/AiGeminiPanel";
import { AiHandoffInline, type PromptGoalSuggestion } from "../components/AiHandoff";
import type { AiGoal } from "../data/aiHandoff";
import "./FutureAIExperience.css";

/** The concept itself stays static in Production. Only a gated Vercel Preview
 * can make the separate, reviewed-evidence Gemini call. */
declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const previewGeminiEnabled = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

// These are suggestions for the SIX manual prompt goals, not a mapping of
// the four concept lenses into additional Gemini capabilities.
const suggestedPromptGoals: Record<GoalId,AiGoal> = {
  explain_brief: "executive",
  explore_interventions: "evidence_audit",
  identify_data_gaps: "data_gaps",
  compare_strategies: "pilot_planning"
};

export default function FutureAIExperiencePage({onHide}: {onHide: () => void}) {
  const snapshot = useConceptBrief(previewGeminiEnabled);
  const [goal, setGoal] = useState<GoalId>("explain_brief");
  const [workflow, setWorkflow] = useState<"prompt" | "gemini">("prompt");
  const [suggestion, setSuggestion] = useState<PromptGoalSuggestion | undefined>();
  const workbench = useRef<HTMLElement>(null);
  function useAsPromptGoal() {
    setSuggestion(previous => ({goal: suggestedPromptGoals[goal], serial: (previous?.serial ?? 0) + 1}));
    setWorkflow("prompt");
    workbench.current?.scrollIntoView({block:"start"});
  }
  const [validated, setValidated] = useState<{identity:string;data:ReviewedGeminiResponse}|null>(null);
  const liveIdentity = JSON.stringify([snapshot?.live.sourceKey, snapshot?.live.snapshot?.envelope.generated_at]);
  const liveResult = validated?.identity === liveIdentity ? validated.data : null;
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
    <div className="fc-banner" role="note"><ConceptIcon name="spark" size={19} /><strong>{previewGeminiEnabled ? "AI-assisted evidence workspace · protected Preview" : conceptLabel}</strong><span>{previewGeminiEnabled ? "Gemini validated selection + illustrative research" : "Demo only · No live AI"}</span></div>
    <header className="fc-hero"><div><div className="fc-hero-meta"><span className="fc-kicker">Diagnostic Odyssey / Future experience lab</span><Link to="/brief">Back to current Brief →</Link><button type="button" className="text-button" onClick={onHide}>Hide future AI concept</button></div><h1>From evidence<br />to better questions<span>.</span></h1><p>{previewGeminiEnabled
  ? "Explore the current Brief through four decision lenses. Run a protected, source-verified Gemini selection, then examine the separately labeled research examples and unanswered questions."
  : "A preview of how a future assistant could help you understand the Brief, structure an investigation and make uncertainty useful."}</p><div className="fc-hero-legend"><span><i className="fc-dot-reviewed" />Current product evidence</span><span><i className="fc-dot-concept" />Illustrative exploration</span><span><i className="fc-dot-future" />{previewGeminiEnabled ? "Gemini: protected Preview only" : "Live AI requires approval"}</span></div></div><div className="fc-orbit" aria-hidden="true"><div className="fc-orbit-line"/><div className="fc-orbit-center"><ConceptIcon name="spark" size={37}/><span>Evidence<br />before inference</span></div><span className="fc-orbit-node fc-orbit-a"><ConceptIcon name="story"/>Brief</span><span className="fc-orbit-node fc-orbit-b"><ConceptIcon name="research"/>Research</span><span className="fc-orbit-node fc-orbit-c"><ConceptIcon name="map"/>Questions</span></div></header>
    {previewGeminiEnabled && <section ref={workbench} className="fc-unified-workbench" aria-label="AI analysis workbench">
      <header className="fc-unified-header">
        <div><p className="fc-kicker">ONE BRIEF · TWO AI WORKFLOWS</p>
          <h2>Choose how to analyze the evidence.</h2>
          <p>Keep full control of the original external-AI prompt, or opt into the more restricted on-site Gemini analysis. Both use the current Brief, but they send different information.</p></div>
        <span>Protected Preview only</span>
      </header>
      <div className="fc-workflow-switch" role="group" aria-label="AI workflow selection">
        <button type="button" aria-pressed={workflow === "prompt"} onClick={() => setWorkflow("prompt")}>1 · Prompt Studio <small>Goal, tasks, preview, Copy / Download / Open</small></button>
        <button type="button" aria-pressed={workflow === "gemini"} onClick={() => setWorkflow("gemini")}>2 · Gemini <small>Consent, verified evidence IDs and pending requests</small></button>
      </div>
      <div className="fc-workflow-panel" hidden={workflow !== "prompt"}>
        <div className="fc-workflow-intro"><strong>Full Planning Brief · external provider handoff</strong>
          <p>All six prompt goals, three default-selected research tasks, your optional question, exact frozen text and manual transfer actions remain available. Changing a prompt goal does not invoke Gemini.</p></div>
        <AiHandoffInline brief={snapshot?.live.brief ?? null} sourceState={snapshot.live.sourceState} suggestion={suggestion} />
      </div>
      <div className="fc-workflow-panel" hidden={workflow !== "gemini"}>
        <div className="fc-live-workspace" aria-label="Protected live Gemini evidence workspace">
          <div className="fc-live-workspace-header"><div><p className="fc-kicker">LIVE / REVIEWED EVIDENCE ONLY</p><h2>Ask Gemini what the reviewed evidence supports.</h2></div><span>Explicit consent · No Brief mutation</span></div>
          <p>Gemini receives only server-resolved reviewed evidence IDs—not the full manual prompt, research tasks, optional question, scenario arithmetic or analyst-authored Data Requests. One validated result can be explored across the four views below.</p>
          {snapshot.live.reason && <p role="status" className="fc-live-unavailable">{snapshot.live.reason}</p>}
          <AiGeminiPanel snapshot={snapshot.live.snapshot} sourceKey={snapshot.live.sourceKey}
            onValidated={data=>setValidated({identity:liveIdentity,data})} />
        </div>
      </div>
    </section>}
    <div className="fc-goal-selector" role="tablist" aria-label="Future experience goals">{goals.map((item, i) => <button role="tab" id={`fc-tab-${item.id}`} aria-controls="fc-output" aria-selected={goal === item.id} tabIndex={goal === item.id ? 0 : -1} ref={element => {controls.current[i] = element;}} key={item.id} onClick={() => setGoal(item.id)} onKeyDown={event => moveTab(event, i)}><span className="fc-tab-icon"><ConceptIcon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="fc-tab-arrow" aria-hidden="true">→</span></button>)}</div>
    <div className="fc-context-strip"><span>Context: <b>Current Planning Brief</b></span><span>National: {snapshot.nationalStatus === "available" ? "reviewed" : "withheld"}</span><span>Local: {snapshot.local.status}</span><span>Pilot: {snapshot.scenario ? "applied assumptions" : "unavailable"}</span></div>
    {previewGeminiEnabled && <div className="fc-prompt-from-view">
      <div><strong>Use this exploration view in a prompt</strong><p>The four views organize the examples below; the six selectable prompt goals remain independent. Click to choose a suggested prompt goal without running Gemini or overwriting your research-task selections.</p></div>
      <button className="button secondary" type="button" onClick={useAsPromptGoal}>Use this view as prompt starting point →</button>
    </div>}
    <div id="fc-output" role="tabpanel" tabIndex={0} aria-labelledby={`fc-tab-${goal}`}><div className="fc-output-content" key={goal}>
      {previewGeminiEnabled && <ConceptLiveSummary goal={goal} result={liveResult} />}
      {goal === "explain_brief" && <ExplainBrief snapshot={snapshot} />}
      {goal === "explore_interventions" && <ExploreInterventions />}
      {goal === "identify_data_gaps" && <IdentifyDataGaps snapshot={snapshot} />}
      {goal === "compare_strategies" && <CompareStrategies />}
    </div></div>
    <details className="fc-activation"><summary><span>{previewGeminiEnabled ? "What remains outside live Gemini?" : "What would it take to activate live AI?"}</span><span className="fc-kicker">Future / gated</span></summary><p>The protected Gemini selection is live but does not retrieve literature, admit intervention effects, verify local applicability, compare strategies quantitatively, or write analyst data. An accountable reviewer, security, privacy and human dispositions are still required.</p><p>The four-tab storyboard itself remains illustrative and cannot enter canonical Brief JSON or print. Prompt Studio only transfers the complete prompt when the user explicitly copies, downloads or manually shares it. Only the separately labeled, consented Gemini workflow makes on-site provider calls.</p><p className="fc-muted">Governance continues independently in issues #68, #26 and #23. This concept does not replace the deterministic Planning Insights in PR #105.</p></details>
  </section>;
}
