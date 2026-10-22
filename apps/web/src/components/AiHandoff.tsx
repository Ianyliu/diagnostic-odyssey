import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { createAiHandoffText, type AiGoal, type AiHandoffTextV1 } from "../data/aiHandoff";
import { AI_GOALS, AI_GOAL_TEMPLATES } from "../data/aiHandoffTemplates";
import { aiHandoffQuestionLength, inspectAiHandoffSource, type AiHandoffSourceState } from "../data/aiHandoffSession";
import { copyAiHandoffText, downloadAiHandoff } from "../data/aiHandoffTransfer";
import { AiGeminiPanel } from "./AiGeminiPanel";
import "./AiHandoff.css";

const stage2Preview = import.meta.env.VITE_GEMINI_STAGE2_PREVIEW === "on";
interface Props { brief: PlanningBrief | null; sourceState: AiHandoffSourceState }

export function AiHandoff(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <div className="ai-handoff-launch">
      <button className="button secondary" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        aria-describedby="ai-handoff-launch-note">Analyze with AI</button>
      <small id="ai-handoff-launch-note" className="ai-handoff-launch-note">{stage2Preview ? "* Manual handoff by default · Protected Preview also offers opt-in Gemini." : "* Manual prompt handoff only · No live AI model or API calls."}</small>
    </div>
    {open && createPortal(<HandoffDialog {...props} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

function HandoffDialog({brief, sourceState, onClose}: Props & {onClose: () => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const goalRef = useRef<HTMLSelectElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const transferEpoch = useRef(0);
  const mounted = useRef(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const [goal, setGoal] = useState<AiGoal>("comprehensive");
  const [question, setQuestion] = useState("");
  const source = inspectAiHandoffSource(brief, sourceState);
  const questionLength = aiHandoffQuestionLength(question);
  const problem = source.problem ?? (questionLength > 2000 ? "Shorten the question to 2,000 Unicode characters or fewer." : null);
  const identity = JSON.stringify([source.key, goal, question]);
  const generate = (): AiHandoffTextV1 | null => {
    if (problem || !brief) return null;
    try { return createAiHandoffText(brief, {goal, optionalQuestion: question}); }
    catch { return null; }
  };
  const [session, setSession] = useState(() => ({observed: identity, snapshot: generate(), stale: false}));
  // Latch drift during rendering: neither a rapid action nor changing back to the
  // previous state can re-enable a preview without explicit regeneration.
  if (session.observed !== identity) {
    setSession({...session, observed: identity, stale: true});
    setTransferStatus("");
  }
  const current = !problem && !session.stale && session.observed === identity && !!session.snapshot;
  const snapshot = session.snapshot;
  const payload = snapshot?.envelope.payload;

  useLayoutEffect(() => {
    transferEpoch.current++;
  }, [identity, snapshot]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    mounted.current = true;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    goalRef.current?.focus();
    return () => {
      mounted.current = false;
      transferEpoch.current++;
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const copy = async () => {
    if (!current || !snapshot || copying) return;
    const epoch = transferEpoch.current;
    setCopying(true);
    setTransferStatus("Copying complete prompt…");
    const outcome = await copyAiHandoffText(snapshot.markdown, navigator.clipboard, window.isSecureContext);
    if (!mounted.current) return;
    setCopying(false);
    if (epoch !== transferEpoch.current) {
      setTransferStatus("The Brief or options changed while copying. Your clipboard may contain the older preview; regenerate and copy again.");
      return;
    }
    setTransferStatus(outcome === "copied" ? "Complete prompt copied to clipboard." :
      `${outcome === "insecure" ? "Automatic copying requires a secure browser context." : outcome === "unsupported" ? "This browser does not support clipboard copying." : "Clipboard access was denied or failed."} Use Select complete prompt, then your device’s Copy command, or download Markdown.`);
  };

  const download = () => {
    if (!current || !snapshot) return;
    try { downloadAiHandoff(snapshot); setTransferStatus("Markdown download requested with the complete preview text."); }
    catch { setTransferStatus("The download could not start. Use Select complete prompt and your device’s Copy command."); }
  };

  return <dialog ref={dialogRef} className="ai-handoff-dialog" aria-labelledby="ai-handoff-title" aria-describedby="ai-handoff-intro"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, select, textarea, summary, [href], [tabindex]"))
        .filter(element => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    }}
    onCancel={event => {event.preventDefault(); onClose();}}>
    <div className="ai-handoff-header">
      <div><p className="eyebrow">PLANNING BRIEF · AI HANDOFF</p><h2 id="ai-handoff-title">Analyze with AI</h2></div>
      <button className="button secondary" type="button" onClick={onClose} aria-label="Close Analyze with AI">Close</button>
    </div>
    <p id="ai-handoff-intro">Prepare a complete prompt for an external AI to interpret the reviewed evidence and analyst assumptions in this Brief. {stage2Preview ? <strong>Manual handoff makes no model calls. A separate protected Gemini action is available below with operator authentication and explicit consent.</strong> : <strong>No live model is connected here; the app does not invoke an AI provider or consume model API tokens.</strong>}</p>
    <div className="ai-handoff-layout">
      <div className="ai-handoff-options">
        <label htmlFor="ai-handoff-goal">Analysis goal</label>
        <select ref={goalRef} id="ai-handoff-goal" value={goal} onChange={event => setGoal(event.target.value as AiGoal)}>
          {AI_GOALS.map(value => <option key={value} value={value}>{AI_GOAL_TEMPLATES[value].label}</option>)}
        </select>
        <p className="ai-handoff-scope"><strong>Scope: Current Planning Brief</strong><br />Only the evidence and selections already included in your Brief.</p>
        <label htmlFor="ai-handoff-question">Optional question</label>
        <textarea id="ai-handoff-question" rows={4} value={question} onChange={event => setQuestion(event.target.value)}
          aria-describedby="ai-question-help ai-question-count" aria-invalid={questionLength > 2000} />
        <p id="ai-question-help" className="ai-handoff-help">Do not enter patient-identifying or other sensitive information.</p>
        <p id="ai-question-count" className="ai-handoff-help" aria-live="polite">{questionLength.toLocaleString("en-US")} / 2,000 Unicode characters (after trimming)</p>
        <div className="ai-handoff-warning">
          <strong>Review before sharing</strong>
          <p>Copying places the prompt on your clipboard. Pasting it into an AI service transfers it to a separately operated service. This app does not send it.</p>
          <p>National evidence is not a local disease-burden estimate. Scenario arithmetic is not causal benefit, savings or ROI. An AI response is not reviewed scientific evidence.</p>
        </div>
      </div>
      <div className="ai-handoff-preview">
        <div className="ai-handoff-preview-heading"><h3>Frozen prompt preview</h3>
          <button className="button secondary" type="button" disabled={!!problem} onClick={() => {
            setSession({observed: identity, snapshot: generate(), stale: false});
            setTransferStatus("");
          }}>Regenerate preview</button>
        </div>
        <p className={current ? "ai-handoff-ready" : "ai-handoff-warning"} role="status">
          {problem ?? (session.stale ? "The Brief or options changed. Regenerate the preview before copying or downloading."
            : !snapshot ? "A prompt could not be generated. Review the source state and try again." : "Preview is current. Copy and download use this exact text.")}
        </p>
        {payload && <>
          <dl className="ai-handoff-inventory" aria-label="Frozen preview contents">
            <div><dt>National findings</dt><dd>{payload.burden_findings.length}</dd></div>
            <div><dt>Selected local indicators</dt><dd>{payload.local_context.length}</dd></div>
            <div><dt>Approved evidence records</dt><dd>{payload.evidence.length}</dd></div>
            <div><dt>Selected data requests</dt><dd>{payload.data_requests.length}</dd></div>
            <div><dt>Acquisition guidance</dt><dd>{payload.acquisition_guidance?.length ?? 0}</dd></div>
            <div><dt>Scenario</dt><dd>{payload.scenario ? "Included" : "Not included"}</dd></div>
          </dl>
          <details className="ai-handoff-provenance"><summary>Artifact identifiers and {snapshot.envelope.advisory_warnings.length} warnings</summary>
            <dl><dt>National artifact</dt><dd>{snapshot.envelope.provenance.national_artifact_version}</dd>
              <dt>Local artifact</dt><dd>{snapshot.envelope.provenance.local_context_artifact_id ?? "Not included"}</dd>
              <dt>Scenario ID</dt><dd>{snapshot.envelope.provenance.scenario_id ?? "Not included"}</dd>
              <dt>Frozen Brief timestamp</dt><dd>{snapshot.envelope.generated_at}</dd></dl>
            <ul>{snapshot.envelope.advisory_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </details>
        </>}
        <label htmlFor="ai-handoff-text">Complete prompt · {snapshot?.plainTextLength.toLocaleString("en-US") ?? 0} Unicode characters</label>
        <textarea ref={textRef} id="ai-handoff-text" className="ai-handoff-text" readOnly value={snapshot?.markdown ?? ""} spellCheck={false}
          aria-describedby="ai-handoff-text-help" />
        <p id="ai-handoff-text-help" className="ai-handoff-help">Full text, without truncation. Source text is displayed literally. Sensitivity series and unselected workspace records are not included.</p>
        <div className="ai-handoff-actions">
          <button className="button" type="button" disabled={!current || copying} onClick={() => void copy()}>Copy complete prompt</button>
          <button className="button secondary" type="button" disabled={!current} onClick={download}>Download Markdown</button>
          <button className="button secondary" type="button" disabled={!current} onClick={() => {
            if (!current) return;
            textRef.current?.focus();
            textRef.current?.select();
            setTransferStatus("Complete prompt selected. Use your device’s Copy command.");
          }}>Select complete prompt</button>
        </div>
        <p className="ai-handoff-help ai-handoff-transfer-status" role="status">{transferStatus}</p>
        {stage2Preview && <AiGeminiPanel snapshot={current ? snapshot : null} sourceKey={identity} />}
      </div>
    </div>
  </dialog>;
}
