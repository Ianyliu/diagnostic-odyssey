import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AI_GOAL_TEMPLATES, AI_HANDOFF_SCHEMA_VERSION, type AiGoal } from "../data/aiHandoffTemplates";
import "./LandingAiDemo.css";

const DEMO_GOALS: ReadonlyArray<{ id: AiGoal; title: string; question: string }> = [
  {
    id: "pilot_planning",
    title: "Test operational bottlenecks",
    question: "Where would capacity limit this pilot, and what should we verify before committing staff and resources?"
  },
  {
    id: "executive",
    title: "Draft an executive brief",
    question: "What should leadership know about the evidence, the assumptions, and the decisions still open?"
  },
  {
    id: "data_gaps",
    title: "Prioritize missing data",
    question: "Which local information should we collect first, and how would it change a planning decision?"
  }
];

export function LandingAiDemo({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
  const [selectedGoal, setSelectedGoal] = useState<AiGoal>("pilot_planning");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % DEMO_GOALS.length;
    else if (event.key === "ArrowUp") next = (index + DEMO_GOALS.length - 1) % DEMO_GOALS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = DEMO_GOALS.length - 1;
    else return;
    event.preventDefault();
    setSelectedGoal(DEMO_GOALS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="atlas-ai-demo" aria-labelledby="landing-ai-demo-title" data-reveal="auto">
      <div className="atlas-ai-demo-grid">
        <div className="atlas-ai-copy">
          <h2 id="landing-ai-demo-title">Give AI a planning question <em>and the evidence to work with.</em></h2>
          <p className="subtle">
            Prepare a manual handoff from your Planning Brief. You choose whether and where to submit it.
          </p>

          <div className="atlas-ai-tabs" role="tablist" aria-orientation="vertical" aria-label="Choose an AI planning question">
            {DEMO_GOALS.map((item, index) => (
              <button
                key={item.id}
                ref={el => { tabRefs.current[index] = el; }}
                id={`landing-ai-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={item.id === selectedGoal}
                aria-controls={`landing-ai-panel-${item.id}`}
                tabIndex={item.id === selectedGoal ? 0 : -1}
                className="atlas-ai-tab"
                onClick={() => setSelectedGoal(item.id)}
                onKeyDown={event => handleKeyDown(event, index)}
              >
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
        </div>

        {DEMO_GOALS.map(goal => {
          const template = AI_GOAL_TEMPLATES[goal.id];
          return (
            <div
              key={goal.id}
              id={`landing-ai-panel-${goal.id}`}
              role="tabpanel"
              aria-labelledby={`landing-ai-tab-${goal.id}`}
              hidden={goal.id !== selectedGoal}
              tabIndex={0}
              className="atlas-ai-packet"
            >
              <div className="atlas-ai-packet-body">
                <div>
                  <strong className="atlas-ai-field-label">What you can ask</strong>
                  <p>{goal.question}</p>
                </div>
                <div>
                  <strong className="atlas-ai-field-label">Evidence supplied from your Brief</strong>
                  <p>Reviewed national findings, selected West Virginia indicators, applied pilot assumptions and calculated outputs, and included data requests.</p>
                </div>
                <div>
                  <strong className="atlas-ai-field-label">Rules that travel with it</strong>
                  <p>Label evidence, assumptions, and unknowns separately. Preserve sources and uncertainty. Avoid causal, savings and ROI claims or using national estimates to infer local prevalence.</p>
                </div>
              </div>

              <details className="technical-disclosure atlas-ai-prompt-details">
                <summary>View prompt instructions</summary>
                <div className="atlas-ai-packet-body">
                  <span className="atlas-ai-schema">{AI_HANDOFF_SCHEMA_VERSION}</span>
                  <p>{template.role}</p>
                  <p>{template.task}</p>
                  <p className="atlas-ai-headings">{template.headings}</p>
                </div>
              </details>

              <div className="atlas-ai-packet-foot">
                <Link className="button" to="/brief">
                  Prepare AI handoff in Brief <span aria-hidden="true">→</span>
                </Link>
                {advisorAvailable && <Link className="text-button" to="/advisor">Open Strategy AI Studio</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
