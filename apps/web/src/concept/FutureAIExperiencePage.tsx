import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AiGeminiPanel, type ReviewedGeminiResponse } from "../components/AiGeminiPanel";
import { AiHandoffInline, type PromptGoalSuggestion } from "../components/AiHandoff";
import type { AiGoal } from "../data/aiHandoff";
import { goals, type GoalId } from "./storyboard";
import { ConceptIcon } from "./ConceptPrimitives";
import { ConceptLiveSummary } from "./ConceptLiveSummary";
import { useConceptBrief } from "./useConceptBrief";
import { ExplainBrief } from "./ExplainBrief";
import { ExploreInterventions } from "./ExploreInterventions";
import { IdentifyDataGaps } from "./IdentifyDataGaps";
import { CompareStrategies } from "./CompareStrategies";
import "./FutureAIExperience.css";

declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const previewGeminiEnabled = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

const suggestedPromptGoals: Record<GoalId, AiGoal> = {
  explain_brief: "executive",
  explore_interventions: "evidence_audit",
  identify_data_gaps: "data_gaps",
  compare_strategies: "comprehensive"
};

export default function FutureAIExperiencePage({ onHide }: { onHide: () => void }) {
  const snapshot = useConceptBrief(previewGeminiEnabled);
  const [goal, setGoal] = useState<GoalId>("explain_brief");
  const [workflow, setWorkflow] = useState<"prompt" | "gemini">(previewGeminiEnabled ? "gemini" : "prompt");
  const [suggestion, setSuggestion] = useState<PromptGoalSuggestion | null>(null);
  const [validated, setValidated] = useState<{ identity: string; data: ReviewedGeminiResponse } | null>(null);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const workbench = useRef<HTMLElement>(null);

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

  const liveIdentity = JSON.stringify([
    snapshot.live.sourceKey,
    snapshot.live.snapshot?.envelope.generated_at,
    snapshot.live.snapshot?.envelope.provenance.national_artifact_version
  ]);
  const liveResult = validated?.identity === liveIdentity ? validated.data : null;

  return (
    <section className="page future-concept">
      <header className="fc-hero">
        <div className="fc-hero-meta">
          <span className="eyebrow">STRATEGY AI STUDIO</span>
          <Link className="text-button" to="/brief">Back to Brief →</Link>
          <button type="button" className="text-button" onClick={onHide}>Hide studio</button>
        </div>
        <h1>From evidence to better questions.</h1>
        <p className="micro-caption">
          {previewGeminiEnabled
            ? "Live on-site Gemini: authenticated previews active · Prompt Studio ready."
            : "Live on-site Gemini: authenticated previews only · Prompt Studio works immediately."}
        </p>
      </header>

      <section ref={workbench} className="fc-unified-workbench" aria-label="Strategy AI Studio">
        {previewGeminiEnabled && <div className="fc-workflow-switch" role="tablist" aria-label="AI workflow">
            <button
              type="button"
              role="tab"
              aria-selected={workflow === "gemini"}
              onClick={() => setWorkflow("gemini")}
            >
              Live Gemini Advisor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workflow === "prompt"}
              onClick={() => setWorkflow("prompt")}
            >
              Prompt Studio
            </button>
          </div>}

        <div className="fc-workflow-panel" hidden={previewGeminiEnabled && workflow !== "prompt"}>
          <AiHandoffInline brief={snapshot?.live.brief ?? null} sourceState={snapshot.live.sourceState} suggestion={suggestion} />
        </div>

        {previewGeminiEnabled && <div className="fc-workflow-panel" hidden={workflow !== "gemini"}>
            <AiGeminiPanel
              snapshot={snapshot.live.snapshot}
              sourceKey={snapshot.live.sourceKey}
              onValidated={data => setValidated({identity: liveIdentity, data})}
            />
            <p className="micro-caption">One validated result can be explored across the four views below.</p>
          </div>}
      </section>

      <div className="fc-goal-selector" role="tablist" aria-label="Interactive lenses">
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

      <div className="fc-prompt-from-view">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSuggestion(previous => ({goal: suggestedPromptGoals[goal], serial: (previous?.serial ?? 0) + 1}));
            setWorkflow("prompt");
            workbench.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Use this view as prompt starting point
        </button>
      </div>

      {previewGeminiEnabled && <ConceptLiveSummary goal={goal} result={liveResult} />}

      <div id="fc-output" role="tabpanel" tabIndex={0} aria-labelledby={`fc-tab-${goal}`}>
        <div className="fc-output-content" key={goal}>
          {goal === "explain_brief" && <ExplainBrief snapshot={snapshot} />}
          {goal === "explore_interventions" && <ExploreInterventions />}
          {goal === "identify_data_gaps" && <IdentifyDataGaps snapshot={snapshot} />}
          {goal === "compare_strategies" && <CompareStrategies />}
        </div>
      </div>
    </section>
  );
}
