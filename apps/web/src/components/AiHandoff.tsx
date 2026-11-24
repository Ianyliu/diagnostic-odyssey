import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { createAiHandoffText, type AiGoal, type AiHandoffTextV1 } from "../data/aiHandoff";
import { AI_GOALS, AI_GOAL_TEMPLATES } from "../data/aiHandoffTemplates";
import { aiHandoffQuestionLength, inspectAiHandoffSource, type AiHandoffSourceState } from "../data/aiHandoffSession";
import { copyAiHandoffText, copyAndOpenAiProvider, downloadAiHandoff } from "../data/aiHandoffTransfer";
import { AI_RESEARCH_MODULES, AI_RESEARCH_MODULE_LABELS, enrichAiHandoff, type AiResearchModule } from "../data/aiHandoffResearch";
import { AI_PUBLIC_RESEARCH_LINKS, availableAiProviders, type AiHandoffProvider } from "../data/aiHandoffProviders";
import { AiGeminiPanel } from "./AiGeminiPanel";
import "./AiHandoff.css";

declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const stage2Preview = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

export interface PromptGoalSuggestion {
  goal: AiGoal;
  serial: number;
}

const STARTER_CHIPS: ReadonlyArray<{ label: string; goal: AiGoal }> = [
  { label: "Comprehensive review", goal: "comprehensive" },
  { label: "Brief leadership", goal: "executive" },
  { label: "Pilot bottlenecks", goal: "pilot_planning" },
  { label: "Data to verify first", goal: "data_gaps" },
  { label: "Audit evidence limits", goal: "evidence_audit" },
  { label: "Technical methods", goal: "technical" }
];

interface Props {
  brief: PlanningBrief | null;
  sourceState: AiHandoffSourceState;
  suggestion?: PromptGoalSuggestion | null;
}

export function AiHandoff(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-handoff-launch">
      <button
        className="button secondary"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-describedby="ai-handoff-launch-note"
      >
        Analyze with AI
      </button>
      <small id="ai-handoff-launch-note" className="ai-handoff-launch-note">
        * Manual prompt handoff only · No live AI model or API calls.
      </small>
      {open && createPortal(<HandoffPanel {...props} inline={false} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}

export function AiHandoffInline(props: Props) {
  return <HandoffPanel {...props} inline />;
}

function HandoffPanel({
  brief,
  sourceState,
  suggestion,
  inline,
  onClose
}: Props & { inline: boolean; onClose?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const goalRef = useRef<HTMLSelectElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const transferEpoch = useRef(0);
  const mounted = useRef(true);
  const [transferStatus, setTransferStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [goal, setGoal] = useState<AiGoal>(suggestion?.goal ?? "comprehensive");
  const [researchModules, setResearchModules] = useState<readonly AiResearchModule[]>(() => [...AI_RESEARCH_MODULES]);
  const [openedProvider, setOpenedProvider] = useState<AiHandoffProvider | null>(null);
  const providers = availableAiProviders(import.meta.env.VITE_AI_PROVIDERS);
  const [question, setQuestion] = useState("");
  const source = inspectAiHandoffSource(brief, sourceState);
  const questionLength = aiHandoffQuestionLength(question);
  const problem = source.problem ?? (questionLength > 2000 ? "Shorten the question to 2,000 Unicode characters or fewer." : null);
  const identity = JSON.stringify([source.key, goal, question, researchModules]);

  const generate = (): AiHandoffTextV1 | null => {
    if (problem || !brief) return null;
    try {
      return enrichAiHandoff(createAiHandoffText(brief, { goal, optionalQuestion: question }), researchModules);
    } catch {
      return null;
    }
  };

  const [session, setSession] = useState(() => ({ observed: identity, snapshot: generate(), stale: false }));
  if (session.observed !== identity) {
    setSession({ ...session, observed: identity, stale: true });
    setTransferStatus("");
  }

  const current = !problem && !session.stale && session.observed === identity && !!session.snapshot;

  const updatePromptOptions = (nextGoal: AiGoal, nextModules: readonly AiResearchModule[]) => {
    transferEpoch.current++;
    setTransferStatus("");
    if (current && brief) {
      let updated: AiHandoffTextV1 | null = null;
      try {
        updated = enrichAiHandoff(
          createAiHandoffText(brief, { goal: nextGoal, optionalQuestion: question }),
          nextModules
        );
      } catch { /* Fail closed when the source is no longer valid. */ }
      setSession({
        observed: JSON.stringify([source.key, nextGoal, question, nextModules]),
        snapshot: updated,
        stale: false
      });
    }
    setGoal(nextGoal);
    setResearchModules(nextModules);
  };

  const lastSuggestionSerial = useRef(suggestion?.serial);
  const updatePromptOptionsRef = useRef(updatePromptOptions);
  updatePromptOptionsRef.current = updatePromptOptions;
  const researchModulesRef = useRef(researchModules);
  researchModulesRef.current = researchModules;
  useEffect(() => {
    if (!suggestion || suggestion.serial === lastSuggestionSerial.current) return;
    lastSuggestionSerial.current = suggestion.serial;
    updatePromptOptionsRef.current(suggestion.goal, researchModulesRef.current);
  }, [suggestion]);

  const snapshot = session.snapshot;
  const payload = snapshot?.envelope.payload;

  useLayoutEffect(() => {
    transferEpoch.current++;
  }, [identity, snapshot]);

  const backdropPointerDown = useRef(false);

  useLayoutEffect(() => {
    if (inline) {
      mounted.current = true;
      return () => {
        mounted.current = false;
        transferEpoch.current++;
      };
    }
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    mounted.current = true;
    dialog.showModal();
    goalRef.current?.focus();
    return () => {
      mounted.current = false;
      transferEpoch.current++;
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [inline]);

  const copy = async () => {
    if (!current || !snapshot || copying) return;
    const epoch = transferEpoch.current;
    setCopying(true);
    setTransferStatus("Copying complete prompt…");
    const outcome = await copyAiHandoffText(snapshot.markdown, navigator.clipboard, window.isSecureContext);
    if (!mounted.current) return;
    setCopying(false);
    if (epoch !== transferEpoch.current) {
      setTransferStatus("Source or options changed while copying; regenerate and copy again.");
      return;
    }
    setTransferStatus(
      outcome === "copied"
        ? "Complete prompt copied to clipboard."
        : "Clipboard unavailable; use Select complete prompt or Download Markdown."
    );
  };

  const copyAndOpen = async (provider: AiHandoffProvider) => {
    if (!current || !snapshot || copying) return;
    const epoch = transferEpoch.current;
    setOpenedProvider(provider);
    setCopying(true);
    setTransferStatus(`Opening ${provider.label} and copying prompt…`);
    const action = copyAndOpenAiProvider(
      snapshot.markdown,
      provider,
      navigator.clipboard,
      window.isSecureContext,
      (url, target, features) => window.open(url, target, features)
    );
    const outcome = await action.copy;
    if (!mounted.current) return;
    setCopying(false);
    if (epoch !== transferEpoch.current) {
      setTransferStatus("Source changed while copying; regenerate before pasting.");
      return;
    }
    setTransferStatus(
      outcome === "copied"
        ? `Prompt copied. Paste manually into ${provider.label}.`
        : "Clipboard copy unavailable; use Select complete prompt or Download Markdown."
    );
  };

  const download = () => {
    if (!current || !snapshot) return;
    try {
      downloadAiHandoff(snapshot);
      setTransferStatus("Markdown download requested.");
    } catch {
      setTransferStatus("Download could not start.");
    }
  };

  const body = (
    <div className="ai-handoff-layout">
      <div className="ai-handoff-options">
        <div className="ai-starter-chips" role="group" aria-label="Quick strategy starters">
          {STARTER_CHIPS.map(chip => (
            <button
              key={chip.goal}
              type="button"
              aria-pressed={goal === chip.goal}
              className={`ai-starter-chip${goal === chip.goal ? " is-active" : ""}`}
              onClick={() => updatePromptOptions(chip.goal, researchModules)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <label htmlFor={inline ? "ai-inline-goal" : "ai-handoff-goal"}>Analysis goal</label>
        <select
          ref={goalRef}
          id={inline ? "ai-inline-goal" : "ai-handoff-goal"}
          value={goal}
          onChange={event => updatePromptOptions(event.target.value as AiGoal, researchModules)}
        >
          {AI_GOALS.map(value => (
            <option key={value} value={value}>{AI_GOAL_TEMPLATES[value].label}</option>
          ))}
        </select>

        <fieldset className="ai-handoff-modules">
          <legend>Optional research tasks</legend>
          {AI_RESEARCH_MODULES.map(module => (
            <label className="ai-handoff-module" key={module}>
              <input
                type="checkbox"
                checked={researchModules.includes(module)}
                onChange={event =>
                  updatePromptOptions(
                    goal,
                    event.target.checked
                      ? [...researchModules, module]
                      : researchModules.filter(value => value !== module)
                  )
                }
              />
              <span>{AI_RESEARCH_MODULE_LABELS[module]}</span>
            </label>
          ))}
        </fieldset>

        <label htmlFor={inline ? "ai-inline-question" : "ai-handoff-question"}>Optional question</label>
        <textarea
          id={inline ? "ai-inline-question" : "ai-handoff-question"}
          rows={3}
          value={question}
          onChange={event => setQuestion(event.target.value)}
          aria-describedby="ai-question-count"
          aria-invalid={questionLength > 2000}
          placeholder="Ask about this Brief (no PHI)…"
        />
        <p id="ai-question-count" className="ai-handoff-help" aria-live="polite">
          {questionLength.toLocaleString("en-US")} / 2,000 characters · No PHI
        </p>

        {stage2Preview && !inline && <AiGeminiPanel snapshot={snapshot} sourceKey={source.key} />}
      </div>

      <div className="ai-handoff-preview">
        <div className="ai-handoff-preview-heading">
          <h3>Frozen prompt preview</h3>
          <button
            className="button secondary"
            type="button"
            disabled={!!problem}
            onClick={() => {
              setSession({ observed: identity, snapshot: generate(), stale: false });
              setTransferStatus("");
            }}
          >
            Regenerate preview
          </button>
        </div>

        <p className={current ? "ai-handoff-ready" : "ai-handoff-warning"} role="status">
          {problem ??
            (session.stale
              ? "Options changed. Regenerate preview before copying."
              : !snapshot
                ? "Prompt could not be generated."
                : "Preview current · Boundaries & guardrails attached.")}
        </p>

        {payload && (
          <dl className="ai-handoff-inventory" aria-label="Frozen preview contents">
            <div><dt>Findings</dt><dd>{payload.burden_findings.length}</dd></div>
            <div><dt>Terrain</dt><dd>{payload.local_context.length}</dd></div>
            <div><dt>Requests</dt><dd>{payload.data_requests.length}</dd></div>
            <div><dt>Scenario</dt><dd>{payload.scenario ? "Included" : "None"}</dd></div>
          </dl>
        )}

        <label htmlFor={inline ? "ai-inline-text" : "ai-handoff-text"}>
          Complete prompt · {snapshot?.plainTextLength.toLocaleString("en-US") ?? 0} chars
        </label>
        <textarea
          ref={textRef}
          id={inline ? "ai-inline-text" : "ai-handoff-text"}
          className="ai-handoff-text"
          readOnly
          value={snapshot?.markdown ?? ""}
          spellCheck={false}
        />

        <div className="ai-handoff-actions">
          <button className="button" type="button" disabled={!current || copying} onClick={() => void copy()}>
            Copy complete prompt
          </button>
          <button className="button secondary" type="button" disabled={!current} onClick={download}>
            Download Markdown
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!current}
            onClick={() => {
              if (!current) return;
              textRef.current?.focus();
              textRef.current?.select();
              setTransferStatus("Complete prompt selected.");
            }}
          >
            Select complete prompt
          </button>
        </div>

        <div className="ai-handoff-provider-area">
          <h3>Copy &amp; open an AI</h3>
          <p className="ai-handoff-help">
            Review the complete preview first; do not share PHI or confidential content. Clicking attempts a local clipboard copy and opens the approved provider homepage, not a chat submission. Paste manually only after reviewing the provider&apos;s data terms. Long pastes may become attachments.
          </p>
          {providers.length > 0 ? (
            <div className="ai-handoff-actions">
              {providers.map(provider => (
                <button
                  key={provider.id}
                  className="button secondary"
                  type="button"
                  disabled={!current || copying}
                  onClick={() => void copyAndOpen(provider)}
                >
                  Copy &amp; open {provider.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="ai-handoff-help">
              Provider launch is not enabled for this deployment. You can still Copy, Download or select the full prompt manually.
            </p>
          )}
          {openedProvider && (
            <p className="ai-handoff-help">
              If the tab did not open:{" "}
              <a href={openedProvider.home} target="_blank" rel="noopener noreferrer">
                Open {openedProvider.label} manually
              </a>
            </p>
          )}
        </div>

        <details className="ai-handoff-research-area">
          <summary>Search published research</summary>
          <ul>
            {AI_PUBLIC_RESEARCH_LINKS.map(link => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
              </li>
            ))}
          </ul>
        </details>

        <p className="ai-handoff-help ai-handoff-transfer-status" role="status">{transferStatus}</p>
      </div>
    </div>
  );

  if (inline) {
    return <div className="ai-handoff-inline">{body}</div>;
  }

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      open={inline || undefined}
      className="ai-handoff-dialog"
      aria-labelledby="ai-handoff-title"
      onPointerDown={event => {
        backdropPointerDown.current = event.target === dialogRef.current;
      }}
      onPointerUp={event => {
        const dialog = dialogRef.current;
        if (!backdropPointerDown.current || !dialog || event.target !== dialog) {
          backdropPointerDown.current = false;
          return;
        }
        backdropPointerDown.current = false;
        const rect = dialog.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) onClose?.();
      }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("button, input, select, textarea, summary, [href], [tabindex]")
        ).filter(element => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={event => {
        event.preventDefault();
        onClose?.();
      }}
    >
      <div className="ai-handoff-header">
        <div>
          <p className="eyebrow">PLANNING BRIEF · PROMPT STUDIO</p>
          <h2 id="ai-handoff-title">Analyze with AI</h2>
        </div>
        <button className="button secondary" type="button" onClick={onClose} aria-label="Close Analyze with AI">
          Close
        </button>
      </div>
      {body}
    </dialog>
  );
}
