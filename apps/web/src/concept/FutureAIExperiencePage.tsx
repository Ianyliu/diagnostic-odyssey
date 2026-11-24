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

const suggestedPromptGoals: Record<GoalId, AiGoal> = {
  explain_brief: "executive",
  explore_interventions: "evidence_audit",
  identify_data_gaps: "data_gaps",
  compare_strategies: "pilot_planning"
};

export default function FutureAIExperiencePage({ onHide }: { onHide: () => void }) {
  const snapshot = useConceptBrief(previewGeminiEnabled);
  const [goal, setGoal] = useState<GoalId>("explain_brief");
  const [workflow, setWorkflow] = useState<"prompt" | "gemini">("prompt");
  const [suggestion, setSuggestion] = useState<PromptGoalSuggestion | undefined>();
  const workbench = useRef<HTMLElement>(null);

  function useAsPromptGoal() {
    setSuggestion(previous => ({ goal: suggestedPromptGoals[goal], serial: (previous?.serial ?? 0) + 1 }));
    setWorkflow("prompt");
    workbench.current?.scrollIntoView({ block: "start" });
  }

  const [validated, setValidated] = useState<{ identity: string; data: ReviewedGeminiResponse } | null>(null);
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
    event.preventDefault();
    setGoal(goals[next]!.id);
    controls.current[next]?.focus();
  }

  if (!snapshot) return null;

  return (
    <section className="page page-stack future-concept">
      <header className="apple-page-header">
        <div className="fc-top-bar">
          <p className="apple-kicker">Edition 01 · Strategy AI Studio</p>
          <div className="fc-top-actions">
            <Link className="text-button" to="/brief">Back to Brief →</Link>
            <button type="button" className="text-button" onClick={onHide}>Hide studio</button>
          </div>
        </div>
        <h1>Strategy AI advisor.</h1>
        <p className="apple-subtitle">
          {previewGeminiEnabled
            ? "Build evidence-bound prompts or run Preview Gemini on reviewed IDs."
            : "Turn your Brief into an evidence-bound prompt for any assistant."}
        </p>
        {!previewGeminiEnabled && (
          <p className="micro-caption" role="status">
            Prompt Studio works immediately with any AI assistant while live on-site Gemini activates in authenticated previews.
          </p>
        )}
      </header>

      <section ref={workbench} className="fc-unified-workbench apple-card" aria-label="Strategy AI Studio workbench">
        <header className="fc-unified-header">
          <div>
            <p className="fc-kicker">PROMPT STUDIO &amp; ADVISOR</p>
            <h2>{previewGeminiEnabled ? "Choose Prompt Studio or Live Gemini." : "Build a frozen strategy prompt."}</h2>
          </div>
          {previewGeminiEnabled && (
            <div className="fc-workflow-switch apple-segmented" role="group" aria-label="AI workflow lane">
              <button type="button" aria-pressed={workflow === "prompt"} onClick={() => setWorkflow("prompt")}>
                Prompt Studio
              </button>
              <button type="button" aria-pressed={workflow === "gemini"} onClick={() => setWorkflow("gemini")}>
                Live Gemini Advisor
              </button>
            </div>
          )}
        </header>

        <div className="fc-workflow-panel" hidden={previewGeminiEnabled && workflow !== "prompt"}>
          <AiHandoffInline
            brief={snapshot?.live.brief ?? null}
            sourceState={snapshot.live.sourceState}
            suggestion={suggestion}
          />
        </div>

        {previewGeminiEnabled && (
          <div className="fc-workflow-panel" hidden={workflow !== "gemini"}>
            <div className="fc-live-workspace" aria-label="Protected live Gemini evidence workspace">
              <div className="fc-live-workspace-header">
                <div>
                  <p className="fc-kicker">LIVE GEMINI ADVISOR · REVIEWED EVIDENCE ONLY</p>
                  <h2>Ask Gemini what the reviewed evidence supports.</h2>
                </div>
                <span className="status status-neutral">Explicit consent · No Brief mutation</span>
              </div>
              <p className="micro-caption">
                Gemini receives reviewed evidence IDs only. One validated result can be explored across the four views below.
              </p>
              {snapshot.live.reason && <p role="status" className="fc-live-unavailable">{snapshot.live.reason}</p>}
              <AiGeminiPanel
                snapshot={snapshot.live.snapshot}
                sourceKey={snapshot.live.sourceKey}
                onValidated={data => setValidated({ identity: liveIdentity, data })}
              />
            </div>
          </div>
        )}
      </section>

      <div className="fc-goal-selector" role="tablist" aria-label="Explore evidence and planning views">
        {goals.map((item, i) => (
          <button
            role="tab"
            id={`fc-tab-${item.id}`}
            aria-controls="fc-output"
            aria-selected={goal === item.id}
            tabIndex={goal === item.id ? 0 : -1}
            ref={element => { controls.current[i] = element; }}
            key={item.id}
            onClick={() => setGoal(item.id)}
            onKeyDown={event => moveTab(event, i)}
          >
            <span className="fc-tab-icon"><ConceptIcon name={item.icon} /></span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
          </button>
        ))}
      </div>

      <div id="fc-output" role="tabpanel" tabIndex={0} aria-labelledby={`fc-tab-${goal}`}>
        <div className="fc-output-content" key={goal}>
          {previewGeminiEnabled && <ConceptLiveSummary goal={goal} result={liveResult} />}
          {goal === "explain_brief" && <ExplainBrief snapshot={snapshot} />}
          {goal === "explore_interventions" && <ExploreInterventions />}
          {goal === "identify_data_gaps" && <IdentifyDataGaps snapshot={snapshot} />}
          {goal === "compare_strategies" && <CompareStrategies />}
        </div>
      </div>

      <div className="fc-prompt-from-view apple-card">
        <div>
          <strong>Use this exploration view in a prompt</strong>
          <p className="micro-caption">Sets the matching prompt goal above without overwriting research tasks.</p>
        </div>
        <button className="button secondary" type="button" onClick={useAsPromptGoal}>
          Use this view as prompt starting point →
        </button>
      </div>

      <details className="fc-activation apple-accordion">
        <summary>
          <span>{previewGeminiEnabled ? "What remains outside live Gemini?" : "What Strategy AI Studio does and does not establish"}</span>
          <span className="fc-kicker">Evidence boundaries</span>
        </summary>
        <p>
          {previewGeminiEnabled
            ? "Protected Gemini selects only reviewed evidence IDs and pending templates; it does not retrieve literature or admit intervention effects."
            : "Prompt Studio prepares a complete evidence-bound prompt for manual handoff. Live on-site Gemini: authenticated previews only."}
        </p>
        <p className="fc-muted">
          Research examples remain illustrative and never enter canonical Brief JSON or print.
        </p>
      </details>
    </section>
  );
}
