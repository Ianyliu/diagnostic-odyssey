import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AI_GOAL_TEMPLATES, AI_HANDOFF_SCHEMA_VERSION, type AiGoal } from "../data/aiHandoffTemplates";
import "./LandingAiDemo.css";

const DEMO_GOALS: ReadonlyArray<{ id: AiGoal; title: string; summary: string }> = [
  {
    id: "pilot_planning",
    title: "Test operational bottlenecks",
    summary: "Examine reach, capacity caps, and verification checks from your scenario."
  },
  {
    id: "executive",
    title: "Draft an executive brief",
    summary: "Separate known evidence, assumptions, and open gaps for leadership."
  },
  {
    id: "data_gaps",
    title: "Prioritize missing data",
    summary: "Rank what local information to verify before expanding a pilot."
  }
];

/**
 * Chapter V tasteful demonstration of Diagnostic Odyssey's governed AI handoff.
 * Surfaces the authentic manual prompt contract (do.ai-handoff.v1) without
 * implying autonomous live execution or unimplemented provider features.
 */
export function LandingAiDemo({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
  const [selectedGoal, setSelectedGoal] = useState<AiGoal>("pilot_planning");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const template = AI_GOAL_TEMPLATES[selectedGoal];

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % DEMO_GOALS.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index + DEMO_GOALS.length - 1) % DEMO_GOALS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = DEMO_GOALS.length - 1;
    else return;
    event.preventDefault();
    const target = DEMO_GOALS[next]!;
    setSelectedGoal(target.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="atlas-ai-demo" aria-labelledby="landing-ai-demo-title" data-reveal="auto">
      <div className="atlas-ai-demo-grid">
        <div className="atlas-ai-copy">
          <p className="eyebrow">GOVERNED AI ASSISTANCE</p>
          <h2 id="landing-ai-demo-title">
            Bring AI into the room—<em>with the scientific rules attached.</em>
          </h2>
          <p className="subtle">
            Diagnostic Odyssey packages your reviewed findings, selected West Virginia context, pilot assumptions, and open data gaps into a structured prompt envelope. It helps teams pressure-test planning questions manually without fabricating evidence or blurring layers.
          </p>

          <div className="atlas-ai-tabs" role="tablist" aria-label="Choose an AI planning question">
            {DEMO_GOALS.map((item, idx) => {
              const selected = item.id === selectedGoal;
              return (
                <button
                  key={item.id}
                  ref={el => { tabRefs.current[idx] = el; }}
                  id={`landing-ai-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`landing-ai-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  className="atlas-ai-tab"
                  onClick={() => setSelectedGoal(item.id)}
                  onKeyDown={event => handleKeyDown(event, idx)}
                >
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={`landing-ai-panel-${selectedGoal}`}
          role="tabpanel"
          aria-labelledby={`landing-ai-tab-${selectedGoal}`}
          className="atlas-ai-packet"
        >
          <div className="atlas-ai-packet-head">
            <span className="atlas-ai-schema">{AI_HANDOFF_SCHEMA_VERSION}</span>
            <span className="status status-ai">Manual prompt · Guardrails attached</span>
          </div>

          <div className="atlas-ai-packet-body">
            <div>
              <span className="atlas-ai-field-label">Analytical lens</span>
              <p>{template.role}</p>
            </div>
            <div>
              <span className="atlas-ai-field-label">Task instruction</span>
              <p>{template.task}</p>
            </div>
            <div>
              <span className="atlas-ai-field-label">Required output structure</span>
              <p className="atlas-ai-headings">{template.headings}</p>
            </div>
          </div>

          <ul className="atlas-ai-guardrails" aria-label="Embedded scientific boundaries">
            <li>Observed vs. assumed vs. unknown separated</li>
            <li>No causal, savings, or ROI claims</li>
            <li>No national-to-local rescaling</li>
            <li>User controls any external submission</li>
          </ul>

          <div className="atlas-ai-packet-foot">
            <p className="micro-caption">
              Preview only — no background model runs automatically from this page.
            </p>
            {advisorAvailable ? (
              <div className="atlas-ai-actions">
                <Link className="button" to="/advisor">
                  Open Strategy AI Studio <span aria-hidden="true">→</span>
                </Link>
                <Link className="text-button" to="/brief">
                  Use in Planning Brief
                </Link>
              </div>
            ) : (
              <Link className="button" to="/brief">
                Prepare AI handoff in Brief <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
