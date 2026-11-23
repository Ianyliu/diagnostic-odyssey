import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { goals, type GoalId } from "./storyboard";
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

/** The unified manual workspace is available in ordinary public builds.
 * Only the separately gated Gemini lane executes in protected Vercel Previews. */
declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const previewGeminiEnabled = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

// These are suggestions for the SIX manual prompt goals, not a mapping of
// the four concept lenses into additional Gemini capabilities.
const suggestedPromptGoals: Record<GoalId, AiGoal> = {
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
    workbench.current?.scrollIntoView({block: "start"});
  }
  const [validated, setValidated] = useState<{identity: string; data: ReviewedGeminiResponse} | null>(null);
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
    <div className="fc-banner" role="note"><ConceptIcon name="spark" size={19} /><strong>Diagnostic Odyssey / Strategy AI Studio</strong><span>{previewGeminiEnabled ? "Prompt Studio + Live Gemini Advisor + Explore" : "Prompt Studio + Explore · ready now"}</span></div>
    <header className="fc-hero">
      <div>
        <div className="fc-hero-meta">
          <span className="fc-kicker">Diagnostic Odyssey / Strategy AI Studio</span>
          <Link to="/brief">Back to Action Brief →</Link>
          <button type="button" className="text-button" onClick={onHide}>Hide Strategy AI Studio</button>
        </div>
        <h1>Strategy AI Studio<span>.</span></h1>
        <p>{previewGeminiEnabled
          ? "Build and copy complete evidence-bound prompts for any AI assistant, run the consent-gated Live Gemini Advisor on reviewed evidence IDs, and explore four strategy lenses."
          : "Turn your current brief into an evidence-bound prompt for any AI assistant, and explore four strategy lenses that keep data, assumptions, and gaps visibly separate."}</p>
        {!previewGeminiEnabled && (
          <p className="fc-status-cue" role="status">Prompt Studio works immediately with any AI assistant while live on-site Gemini activates in authenticated previews.</p>
        )}
        <div className="fc-hero-legend">
          <span><i className="fc-dot-reviewed" />Reviewed product evidence</span>
          <span><i className="fc-dot-concept" />Illustrative exploration</span>
          <span><i className="fc-dot-future" />{previewGeminiEnabled ? "Live Gemini Advisor: authenticated Preview" : "Live on-site Gemini: authenticated previews only"}</span>
        </div>
      </div>
      <div className="fc-orbit" aria-hidden="true">
        <div className="fc-orbit-line" />
        <div className="fc-orbit-center"><ConceptIcon name="spark" size={37} /><span>Evidence<br />before inference</span></div>
        <span className="fc-orbit-node fc-orbit-a"><ConceptIcon name="story" />Brief</span>
        <span className="fc-orbit-node fc-orbit-b"><ConceptIcon name="research" />Research</span>
        <span className="fc-orbit-node fc-orbit-c"><ConceptIcon name="map" />Questions</span>
      </div>
    </header>
    <section ref={workbench} className="fc-unified-workbench" aria-label="Strategy AI Studio workbench">
      <header className="fc-unified-header">
        <div>
          <p className="fc-kicker">STRATEGY AI STUDIO · PROMPT &amp; ADVISOR</p>
          <h2>{previewGeminiEnabled ? "Choose Prompt Studio or Live Gemini Advisor." : "Build an evidence-bound strategy prompt."}</h2>
          <p>{previewGeminiEnabled
            ? "Use Prompt Studio with any external AI assistant, or authorize the Live Gemini Advisor on server-verified evidence IDs. The two modes send different information."
            : "Pick a quick strategy starter or goal, add an optional question, and copy or download a complete prompt grounded in your current brief."}</p>
        </div>
        <span>{previewGeminiEnabled ? "Protected Gemini Preview available" : "Prompt Studio · works with any AI"}</span>
      </header>
      {previewGeminiEnabled && <div className="fc-workflow-switch" role="group" aria-label="AI workflow selection">
        <button type="button" aria-pressed={workflow === "prompt"} onClick={() => setWorkflow("prompt")}>1 · Prompt Studio <small>Starters, goals, tasks, Copy / Download / Open</small></button>
        <button type="button" aria-pressed={workflow === "gemini"} onClick={() => setWorkflow("gemini")}>2 · Live Gemini Advisor <small>Consent, verified evidence IDs and pending requests</small></button>
      </div>}
      <div className="fc-workflow-panel" hidden={previewGeminiEnabled && workflow !== "prompt"}>
        <div className="fc-workflow-intro">
          <strong>Prompt Studio · works with any AI assistant</strong>
          <p>All six prompt goals, three default-selected research tasks, your optional question, exact frozen text and manual transfer actions remain available. Changing a prompt goal does not invoke Gemini.</p>
        </div>
        <AiHandoffInline brief={snapshot?.live.brief ?? null} sourceState={snapshot.live.sourceState} suggestion={suggestion} />
      </div>
      {previewGeminiEnabled && <div className="fc-workflow-panel" hidden={workflow !== "gemini"}>
        <div className="fc-live-workspace" aria-label="Protected live Gemini evidence workspace">
          <div className="fc-live-workspace-header">
            <div><p className="fc-kicker">LIVE GEMINI ADVISOR · REVIEWED EVIDENCE ONLY</p><h2>Ask Gemini what the reviewed evidence supports.</h2></div>
            <span>Explicit consent · No Brief mutation</span>
          </div>
          <p>Gemini receives only server-resolved reviewed evidence IDs—not the full manual prompt, research tasks, optional question, scenario arithmetic or analyst-authored Data Requests. One validated result can be explored across the four views below.</p>
          {snapshot.live.reason && <p role="status" className="fc-live-unavailable">{snapshot.live.reason}</p>}
          <AiGeminiPanel snapshot={snapshot.live.snapshot} sourceKey={snapshot.live.sourceKey}
            onValidated={data => setValidated({identity: liveIdentity, data})} />
        </div>
      </div>}
    </section>
    <div className="fc-goal-selector" role="tablist" aria-label="Explore evidence and planning views">{goals.map((item, i) => <button role="tab" id={`fc-tab-${item.id}`} aria-controls="fc-output" aria-selected={goal === item.id} tabIndex={goal === item.id ? 0 : -1} ref={element => {controls.current[i] = element;}} key={item.id} onClick={() => setGoal(item.id)} onKeyDown={event => moveTab(event, i)}><span className="fc-tab-icon"><ConceptIcon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="fc-tab-arrow" aria-hidden="true">→</span></button>)}</div>
    <div className="fc-context-strip"><span>Context: <b>Current Planning Brief</b></span><span>National: {snapshot.nationalStatus === "available" ? "reviewed" : "withheld"}</span><span>Local: {snapshot.local.status}</span><span>Pilot: {snapshot.scenario ? "applied assumptions" : "unavailable"}</span></div>
    <div id="fc-output" role="tabpanel" tabIndex={0} aria-labelledby={`fc-tab-${goal}`}><div className="fc-output-content" key={goal}>
      {previewGeminiEnabled && <ConceptLiveSummary goal={goal} result={liveResult} />}
      {goal === "explain_brief" && <ExplainBrief snapshot={snapshot} />}
      {goal === "explore_interventions" && <ExploreInterventions />}
      {goal === "identify_data_gaps" && <IdentifyDataGaps snapshot={snapshot} />}
      {goal === "compare_strategies" && <CompareStrategies />}
    </div></div>
    <div className="fc-prompt-from-view">
      <div><strong>Use this exploration view in a prompt</strong><p>The four lenses organize the examples below; the six selectable prompt goals remain independent. Click to choose a suggested prompt goal without running Gemini or overwriting your research-task selections.</p></div>
      <button className="button secondary" type="button" onClick={useAsPromptGoal}>Use this view as prompt starting point →</button>
    </div>
    <details className="fc-activation">
      <summary><span>{previewGeminiEnabled ? "What remains outside live Gemini?" : "What Strategy AI Studio does and does not establish"}</span><span className="fc-kicker">Evidence boundaries</span></summary>
      <p>{previewGeminiEnabled ? "Protected Gemini selects only reviewed evidence IDs and pending templates; it does not retrieve literature, admit intervention effects, verify local applicability, compare strategies quantitatively or write analyst data." : "Prompt Studio prepares a complete evidence-bound prompt for analyst-controlled external AI handoff. It does not make a model call or review new literature."} An accountable reviewer, security, privacy and human dispositions are still required.</p>
      <p>Research examples and comparisons in Explore remain illustrative; they do not enter canonical Brief JSON or print. Prompt Studio never invokes a model automatically. Copy, Download and Copy &amp; Open are explicit analyst actions; an external provider receives the prompt only when the analyst chooses to share it. Live on-site Gemini calls are restricted to authenticated, consented Previews.</p>
      <p className="fc-muted">Governance continues independently in issues #68, #26 and #23. This studio does not replace deterministic Planning Insights.</p>
    </details>
  </section>;
}
