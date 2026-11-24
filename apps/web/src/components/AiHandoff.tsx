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

/** Vite injects only this public build-time boolean; no browser environment secret. */
declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const stage2Preview = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean"
  ? __DO_GEMINI_STAGE2_PREVIEW__ : false;

interface Props {
  brief: PlanningBrief | null;
  sourceState: AiHandoffSourceState;
  buttonLabel?: string;
}

export interface PromptGoalSuggestion {
  goal: AiGoal;
  serial: number;
}

const QUICK_STRATEGY_STARTERS: ReadonlyArray<{ goal: AiGoal; label: string }> = [
  { goal: "executive", label: "Brief leadership on hidden costs" },
  { goal: "pilot_planning", label: "Find the biggest pilot bottleneck" },
  { goal: "data_gaps", label: "List what data to verify first" },
  { goal: "evidence_audit", label: "Audit evidence limits" },
  { goal: "comprehensive", label: "Full strategy review" },
  { goal: "technical", label: "Check methods & provenance" }
];

export function AiHandoffInline(props: Props & { suggestion?: PromptGoalSuggestion | undefined }) {
  return <HandoffDialog {...props} presentation="inline" onClose={() => {}} />;
}

export function AiHandoff({ buttonLabel = "Strategy AI", ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="button ai-accent"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={buttonLabel}
      >
        {buttonLabel}
      </button>
      {open && createPortal(<HandoffDialog {...props} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function HandoffDialog({
  brief,
  sourceState,
  onClose,
  presentation = "modal",
  suggestion
}: Props & {
  onClose: () => void;
  presentation?: "modal" | "inline";
  suggestion?: PromptGoalSuggestion | undefined;
}) {
  const inline = presentation === "inline";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const goalRef = useRef<HTMLSelectElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const transferEpoch = useRef(0);
  const mounted = useRef(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [goal, setGoal] = useState<AiGoal>("comprehensive");
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

  useEffect(() => {
    if (suggestion) {
      updatePromptOptions(suggestion.goal, researchModules);
      goalRef.current?.focus();
    }
  }, [suggestion?.serial]);

  const snapshot = session.snapshot;
  const payload = snapshot?.envelope.payload;

  useLayoutEffect(() => {
    transferEpoch.current++;
  }, [identity, snapshot]);

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
      dialog.close();
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
      setTransferStatus("The Brief or options changed while copying. Regenerate and copy again.");
      return;
    }
    setTransferStatus(
      outcome === "copied"
        ? "Complete prompt copied to clipboard."
        : `${outcome === "insecure" ? "Automatic copying requires HTTPS." : outcome === "unsupported" ? "Clipboard API unavailable." : "Clipboard access denied."} Use Select complete prompt or Download Markdown.`
    );
  };

  const copyAndOpen = async (provider: AiHandoffProvider) => {
    if (!current || !snapshot || copying) return;
    const epoch = transferEpoch.current;
    setOpenedProvider(provider);
    setCopying(true);
    setTransferStatus("Opening " + provider.label + " and copying complete prompt…");
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
      setTransferStatus("Source changed while copying. Regenerate before pasting.");
      return;
    }
    const launchNote = action.launch === "failed" ? "Provider page could not open automatically. " : "";
    setTransferStatus(
      launchNote +
        (outcome === "copied"
          ? `Complete prompt copied. Paste into ${provider.label} manually.`
          : "Clipboard copy unavailable. Use Select complete prompt or Download Markdown.")
    );
  };

  const download = () => {
    if (!current || !snapshot) return;
    try {
      downloadAiHandoff(snapshot);
      setTransferStatus("Markdown download requested with the complete preview text.");
    } catch {
      setTransferStatus("Download could not start. Use Select complete prompt.");
    }
  };

  const body = (
    <>
      <div className="ai-handoff-header">
        <div>
          <p className="apple-kicker">PLANNING BRIEF · STRATEGY AI</p>
          <h2 id="ai-handoff-title">Analyze with AI</h2>
        </div>
        {!inline && (
          <button className="apple-detail-close" type="button" onClick={onClose} aria-label="Close Analyze with AI">
            ✕
          </button>
        )}
      </div>

      <p id="ai-handoff-intro" className="micro-caption">
        {stage2Preview
          ? "Manual Prompt Studio exports complete context; Protected Gemini uses reviewed IDs only."
          : "Manual prompt handoff only · No automatic model API calls."}
      </p>

      <div className="ai-starter-pills" role="group" aria-label="Quick strategy starters">
        {QUICK_STRATEGY_STARTERS.map(starter => (
          <button
            key={starter.goal}
            type="button"
            className={`ai-starter-pill${goal === starter.goal ? " active" : ""}`}
            aria-pressed={goal === starter.goal}
            onClick={() => updatePromptOptions(starter.goal, researchModules)}
          >
            {starter.label}
          </button>
        ))}
      </div>

      <div className="ai-handoff-layout">
        <div className="ai-handoff-options">
          <label htmlFor="ai-handoff-goal">Analysis goal</label>
          <select
            ref={goalRef}
            id="ai-handoff-goal"
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

          <label htmlFor="ai-handoff-question">Optional question</label>
          <textarea
            id="ai-handoff-question"
            rows={3}
            value={question}
            onChange={event => setQuestion(event.target.value)}
            aria-describedby="ai-question-help ai-question-count"
            aria-invalid={questionLength > 2000}
            placeholder="Ask a focused planning question (no PHI)…"
          />
          <p id="ai-question-help" className="ai-handoff-help">Do not enter patient-identifying or confidential information.</p>
          <p id="ai-question-count" className="ai-handoff-help mono-figure" aria-live="polite">
            {questionLength.toLocaleString("en-US")} / 2,000 Unicode characters
          </p>

          <details className="apple-accordion">
            <summary>Review before sharing</summary>
            <p>Read the complete frozen prompt before copying. Copying writes to your clipboard only; provider homepages do not receive data until you paste.</p>
            <p>National evidence is descriptive; scenario math is not causal savings or ROI.</p>
          </details>
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
                ? "The Brief or options changed. Regenerate the preview before copying or downloading."
                : !snapshot
                  ? "A prompt could not be generated."
                  : "Preview is current. Copy and download use this exact text.")}
          </p>

          {payload && (
            <>
              <dl className="ai-handoff-inventory" aria-label="Frozen preview contents">
                <div><dt>National</dt><dd className="mono-figure">{payload.burden_findings.length}</dd></div>
                <div><dt>Local</dt><dd className="mono-figure">{payload.local_context.length}</dd></div>
                <div><dt>Evidence</dt><dd className="mono-figure">{payload.evidence.length}</dd></div>
                <div><dt>Requests</dt><dd className="mono-figure">{payload.data_requests.length}</dd></div>
                <div><dt>Hints</dt><dd className="mono-figure">{payload.acquisition_guidance?.length ?? 0}</dd></div>
                <div><dt>Scenario</dt><dd>{payload.scenario ? "Included" : "None"}</dd></div>
              </dl>

              <details className="ai-handoff-provenance apple-accordion">
                <summary>Artifact identifiers &amp; {snapshot.envelope.advisory_warnings.length} warnings</summary>
                <dl>
                  <dt>National artifact</dt><dd>{snapshot.envelope.provenance.national_artifact_version}</dd>
                  <dt>Local artifact</dt><dd>{snapshot.envelope.provenance.local_context_artifact_id ?? "Not included"}</dd>
                  <dt>Scenario ID</dt><dd>{snapshot.envelope.provenance.scenario_id ?? "Not included"}</dd>
                  <dt>Timestamp</dt><dd>{snapshot.envelope.generated_at}</dd>
                </dl>
                <ul>{snapshot.envelope.advisory_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </details>
            </>
          )}

          <label htmlFor="ai-handoff-text">
            Complete prompt · <span className="mono-figure">{snapshot?.plainTextLength.toLocaleString("en-US") ?? 0}</span> characters
          </label>
          <textarea
            ref={textRef}
            id="ai-handoff-text"
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
                setTransferStatus("Complete prompt selected. Use your device’s Copy command.");
              }}
            >
              Select complete prompt
            </button>
          </div>

          <div className="ai-handoff-provider-area">
            <h3>Copy &amp; open an AI</h3>
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
              {!providers.length && (
                <p className="ai-handoff-help">Provider launch is not enabled. Use Copy or Download manually.</p>
              )}
            </div>
            {openedProvider && (
              <p className="ai-handoff-help">
                Fallback link:{" "}
                <a href={openedProvider.home} target="_blank" rel="noopener noreferrer">
                  Open {openedProvider.label} manually
                </a>.
              </p>
            )}
          </div>

          <div className="ai-handoff-research-area">
            <h3>Search published research</h3>
            <ul>
              {AI_PUBLIC_RESEARCH_LINKS.map(link => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <p className="ai-handoff-help ai-handoff-transfer-status" role="status">{transferStatus}</p>

          {stage2Preview && !inline && (
            <AiGeminiPanel snapshot={snapshot} sourceKey={source.key} />
          )}
        </div>
      </div>
    </>
  );

  if (inline) {
    return <div className="ai-handoff-inline">{body}</div>;
  }

  return (
    <dialog
      ref={dialogRef}
      open={inline || undefined}
      className="ai-handoff-dialog"
      aria-labelledby="ai-handoff-title"
      aria-describedby="ai-handoff-intro"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, summary, [href], [tabindex]"
          )
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
        onClose();
      }}
    >
      {body}
    </dialog>
  );
}
