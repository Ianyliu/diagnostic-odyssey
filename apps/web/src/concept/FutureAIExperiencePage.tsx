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
const previewGeminiEnabled =
  typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

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
  const [guardrailOpen, setGuardrailOpen] = useState(false);
  const workbench = useRef<HTMLElement>(null);

  function useAsPromptGoal() {
    setSuggestion(previous => ({goal: suggestedPromptGoals[goal], serial: (previous?.serial ?? 0) + 1}));
    setWorkflow("prompt");
    workbench.current?.scrollIntoView({ block: "start" });
  }

  const [validated, setValidated] = useState<{
    identity: string;
    data: ReviewedGeminiResponse;
  } | null>(null);
  const liveIdentity = JSON.stringify([
    snapshot?.live.sourceKey,
    snapshot?.live.snapshot?.envelope.generated_at
  ]);
  const liveResult = validated?.identity === liveIdentity ? validated.data : null;
  const controls = useRef<(HTMLButtonElement | null)[]>([]);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % goals.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index + goals.length - 1) % goals.length;
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
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">AI STRATEGIST · STRATEGY AI STUDIO</p>
          <h1>Interrogate the brief with bounds intact</h1>
          <p>
            {previewGeminiEnabled
              ? "Prompt Studio and consent-gated Live Gemini Advisor."
              : "Prompt Studio works immediately; live on-site Gemini activates in authenticated previews."}
          </p>
          <p className="micro-caption">
            {previewGeminiEnabled
              ? "Live Gemini Advisor: authenticated Preview"
              : "Live on-site Gemini: authenticated previews only"}
          </p>
        </div>
        <div className="section-header-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => setGuardrailOpen(true)}
            aria-haspopup="dialog"
          >
            Audit Trail &amp; Guardrails
          </button>
          <Link className="button secondary" to="/brief">
            04 Brief →
          </Link>
          <button type="button" className="text-button" onClick={onHide}>
            Hide studio
          </button>
        </div>
      </header>

      <section ref={workbench} className="fc-unified-workbench" aria-label="Strategy AI Studio workbench">
        {previewGeminiEnabled && <div className="fc-workflow-switch" role="group" aria-label="AI workflow selection">
            <button
              type="button"
              aria-pressed={workflow === "prompt"}
              onClick={() => setWorkflow("prompt")}
            >
              1 · Prompt Studio <small>Starters, goals, Copy / Download / Open</small>
            </button>
            <button
              type="button"
              aria-pressed={workflow === "gemini"}
              onClick={() => setWorkflow("gemini")}
            >
              2 · Live Gemini Advisor <small>Consent, verified evidence IDs</small>
            </button>
          </div>}

        <div className="fc-workflow-panel" hidden={previewGeminiEnabled && workflow !== "prompt"}>
          <AiHandoffInline brief={snapshot?.live.brief ?? null} sourceState={snapshot.live.sourceState} suggestion={suggestion} />
        </div>

        {previewGeminiEnabled && <div className="fc-workflow-panel" hidden={workflow !== "gemini"}>
            <div className="fc-live-workspace" aria-label="Protected live Gemini evidence workspace">
              <div className="fc-live-workspace-header">
                <div>
                  <p className="fc-kicker">LIVE GEMINI ADVISOR · REVIEWED EVIDENCE ONLY</p>
                  <h2>Ask Gemini what the reviewed evidence supports.</h2>
                </div>
                <span className="status status-reviewed">Explicit consent · ID-only</span>
              </div>
              <p className="subtle">
                One validated result can be explored across the four views below.
              </p>
              {snapshot.live.reason && (
                <p role="status" className="fc-live-unavailable">
                  {snapshot.live.reason}
                </p>
              )}
              <AiGeminiPanel
                snapshot={snapshot.live.snapshot}
                sourceKey={snapshot.live.sourceKey}
                onValidated={data => setValidated({identity: liveIdentity, data})}
              />
            </div>
          </div>}
      </section>

      <div className="fc-goal-selector" role="tablist" aria-label="Explore evidence and planning views">
        {goals.map((item, i) => (
          <button
            role="tab"
            id={`fc-tab-${item.id}`}
            aria-controls="fc-output"
            aria-selected={goal === item.id}
            tabIndex={goal === item.id ? 0 : -1}
            ref={element => {
              controls.current[i] = element;
            }}
            key={item.id}
            onClick={() => setGoal(item.id)}
            onKeyDown={event => moveTab(event, i)}
          >
            <span className="fc-tab-icon">
              <ConceptIcon name={item.icon} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
            <span className="fc-tab-arrow" aria-hidden="true">
              →
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

      <div className="fc-prompt-from-view">
        <div>
          <strong>Send this exploration lens to Prompt Studio</strong>
          <p className="subtle">Suggests a matching prompt goal without running Gemini.</p>
        </div>
        <button className="button secondary" type="button" onClick={useAsPromptGoal}>
          Use this view as prompt starting point →
        </button>
      </div>

      {guardrailOpen && (
        <div
          className="inspector-drawer-backdrop"
          onClick={event => {
            if (event.target === event.currentTarget) setGuardrailOpen(false);
          }}
        >
          <aside
            className="inspector-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Strategy AI Studio audit trail and guardrails"
          >
            <div className="inspector-drawer-head">
              <div>
                <p className="eyebrow">AUDIT TRAIL &amp; GUARDRAILS</p>
                <h2>AI Evidence Boundaries</h2>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setGuardrailOpen(false)}
              >
                Close
              </button>
            </div>
            <dl className="inspector-dl">
              <div>
                <dt>National evidence state</dt>
                <dd>{snapshot.nationalStatus === "available" ? "Reviewed" : "Withheld"}</dd>
              </div>
              <div>
                <dt>Local context state</dt>
                <dd>{snapshot.local.status}</dd>
              </div>
              <div>
                <dt>Pilot scenario state</dt>
                <dd>{snapshot.scenario ? "Applied assumptions" : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Activation rules</dt>
                <dd>
                  {previewGeminiEnabled
                    ? "Protected Gemini selects only reviewed evidence IDs and pending templates; it does not retrieve literature, admit intervention effects, verify local applicability, or write analyst data."
                    : "Prompt Studio prepares a complete evidence-bound prompt for analyst-controlled external AI handoff. It makes no model calls."}
                </dd>
              </div>
              <div>
                <dt>Scope boundary</dt>
                <dd>
                  Illustrative exploration lenses never enter canonical Brief JSON or print. Does not
                  replace deterministic Planning Insights.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </section>
  );
}
