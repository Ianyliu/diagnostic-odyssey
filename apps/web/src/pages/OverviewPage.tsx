import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { OpeningProvenance, useOpeningMotion } from "./OpeningProvenance";
import { HeadlineFindings } from "../components/HeadlineFindings";
import { LandingJourney } from "../components/LandingJourney";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import "./OverviewPage.css";

const journey: ReadonlyArray<readonly [
  step: string,
  title: string,
  outcome: string,
  to: string
]> = [
  ["1", "Describe burden", "Review national burden estimates with survey uncertainty and explicit interpretation boundaries.", "/burden"],
  ["2", "Review local constraints", "Inspect implementation and access context without turning national burden into a local disease estimate.", "/local-context"],
  ["3", "Scope a feasible pilot", "Set explicit planning assumptions and stress-test reach, capacity, timing, and resources.", "/pilot"],
  ["4", "Create a planning brief", "Export reviewed evidence, selected context, assumptions, boundaries, and remaining gaps.", "/brief"]
];

export function OverviewPage() {
  const opening = useOpeningMotion();
  const {bundle, localContext, localContextStatus} = useArtifact();
  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;
  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  return (
    <section className={"page page-stack overview-page" + (opening.playing ? " is-opening" : "")}>
      <section className="overview-hero" aria-labelledby="overview-title">
        <div className="overview-hero-grid" aria-hidden="true" />
        <div className="overview-hero-intro">
          <p className="overview-kicker">Evidence into planning, with boundaries intact.</p>
          <h1 id="overview-title">
            Chart the road from <em>data</em> to <em>action.</em>
          </h1>
        </div>
        <div className="overview-hero-details">
          <p className="overview-lede">
            <strong className="overview-audience">For state health departments and Medicaid programs scoping Long COVID care-navigation pilots.</strong> Understand what the evidence shows, see the conditions on the ground, test a response—and carry a brief you can defend into the room.
          </p>
          <div className="overview-hero-actions" role="group" aria-label="Start exploring Diagnostic Odyssey">
            <Link className="button overview-primary-cta" to="/burden">Explore reviewed burden <span aria-hidden="true">↗</span></Link>
            <Link className="overview-secondary-cta" to="/pilot">Open the planner <span aria-hidden="true">→</span></Link>
            {planningInsightsEnabled && <Link className="overview-tertiary-cta" to="/brief#planning-insights">See planning insights <span aria-hidden="true">→</span></Link>}
          </div>
        </div>
        <div className="overview-hero-journey">
          <LandingJourney />
        </div>
        <div className="overview-hero-state">
          <span>Now charting</span>
          <span>Long COVID</span>
          <span>West Virginia</span>
          <span>Reviewed national evidence + local implementation context</span>
        </div>
      </section>

      <section className="overview-story" aria-label="How Diagnostic Odyssey moves from data to planning">
        <div className="overview-story-copy">
          <p className="overview-kicker">Try the pathway, not just the dashboard</p>
          <h2>Dashboards stop at the statistic. <em>Planning starts after it.</em></h2>
          <p>Long COVID&rsquo;s burden goes beyond the bill. Review national evidence and its uncertainty, understand local constraints, then test explicit pilot assumptions without confusing them with observed effects.</p>
          <dl className="overview-proof" aria-label="Current workspace evidence">
            <div>
              <dt>{reviewedCount || "—"}</dt>
              <dd>reviewed national estimates</dd>
            </div>
            <div>
              <dt>{localIndicatorCount ?? "—"}</dt>
              <dd>reviewed local-context indicators</dd>
            </div>
          </dl>
          <p className="overview-source-note">Grounded in <strong>MEPS</strong>, <strong>HRSA</strong> and <strong>ACS</strong> · source boundaries stay visible.</p>
          <Link className="overview-story-link" to="/pilot">Explore the pilot planning workspace <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="overview-hero-motion">
          <OpeningProvenance playing={opening.playing} runId={opening.runId} onReplay={opening.replay} reducedMotion={opening.reducedMotion} announcement={opening.announcement} />
        </div>
      </section>

      <HeadlineFindings />

      <section className="overview-value-prop" aria-labelledby="overview-value-title">
        <div className="overview-section-heading">
          <p className="visual-kicker">HOW EVIDENCE TRAVELS</p>
          <h2 id="overview-value-title">Different evidence, distinct purposes.</h2>
          <p>MEPS describes national burden; HRSA and ACS describe local implementation context, not local Long COVID prevalence; analyst inputs are planning assumptions, not observed effects. The three are never blended into one estimate.</p>
        </div>
        <div className="overview-role-grid" role="list" aria-label="How to read evidence and planning information">
          <div className="overview-role-card reviewed" role="listitem">
            <p>01 / REVIEWED · NATIONAL</p>
            <h3>Observed burden</h3>
            <span>Reviewed survey estimates retain their population, units, uncertainty and release conditions.</span>
          </div>
          <div className="overview-role-card context" role="listitem">
            <p>02 / REVIEWED · LOCAL</p>
            <h3>Delivery context</h3>
            <span>HRSA and ACS describe implementation conditions. They do not create local illness-burden estimates.</span>
          </div>
          <div className="overview-role-card assumption" role="listitem">
            <p>03 / EDITABLE · HYPOTHETICAL</p>
            <h3>Planning assumptions</h3>
            <span>Reach, capacity and resources are inputs to a scenario, not observations or measured intervention effects.</span>
          </div>
          <div className="overview-role-card gap" role="listitem">
            <p>04 / UNRESOLVED · NEXT STEP</p>
            <h3>Evidence and data gaps</h3>
            <span>Outstanding questions can become explicit data requests when the analyst chooses to include them.</span>
          </div>
        </div>
        <p className="overview-value-echo">The opening provenance circuit connects each evidence role to a documented planning artifact—not to a pooled estimate or invented effect.</p>
      </section>

      <section className="overview-two-lenses" aria-labelledby="overview-lenses-title">
        <div className="overview-section-heading">
          <p className="visual-kicker">TWO LENSES, KEPT APART</p>
          <h2 id="overview-lenses-title">National evidence describes the burden. <em>Local data describes the ground.</em></h2>
          <p>These sources answer different questions. Neither a national contrast nor a local workforce indicator automatically establishes a state-level disease burden.</p>
        </div>
        <div className="overview-lenses-grid">
          <Link to="/burden" className="overview-lens is-national">
            <span className="overview-lens-label">Reviewed evidence · national</span>
            <strong className="overview-lens-count">{reviewedCount || "—"}</strong>
            <h3>National burden estimates</h3>
            <p>MEPS measures retain source, population, native units, survey uncertainty and release conditions.</p>
            <span className="overview-lens-action">Explore reviewed burden <span aria-hidden="true">↗</span></span>
          </Link>
          <span className="overview-lens-separator" aria-hidden="true">Never blended</span>
          <Link to="/local-context" className="overview-lens is-local">
            <span className="overview-lens-label">Reviewed implementation context · state</span>
            <strong className="overview-lens-count">{localIndicatorCount ?? "—"}</strong>
            <h3>Local delivery indicators</h3>
            <p>HRSA and ACS describe access, service supply and community conditions without inventing local prevalence.</p>
            <span className="overview-lens-action">Read local context <span aria-hidden="true">↗</span></span>
          </Link>
        </div>
      </section>

      <nav className="overview-destinations" aria-label="Workspace navigation">
        <div className="overview-section-heading overview-destinations-heading">
          <p className="visual-kicker">HOW IT WORKS</p>
          <h2>A clear path from evidence to a plan.</h2>
          <p>Start where you need. Review the evidence, test assumptions, and capture what you still need to know.</p>
        </div>
        <div className="journey-grid">
          {journey.map(([step, title, outcome, to]) => (
            <Link key={step} className="journey-card" to={to}>
              <span className="journey-index" aria-hidden="true">{step.padStart(2, "0")}</span>
              <strong>{title}</strong>
              <small>{outcome}</small>
              <span className="journey-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
        <p className="overview-workflow-note">Within your pilot: <Link to="/pilot#sensitivity">test sensitivity</Link> → <Link to="/data-requests">capture data needs</Link> → review your brief. <Link to="/evidence">Intervention evidence &amp; limits</Link> stays separate from descriptive burden.</p>
      </nav>

      <section className="overview-closing" aria-labelledby="overview-closing-title">
        <div>
          <p className="overview-kicker">THE ACTION-READY PLAN</p>
          <h2 id="overview-closing-title">Leave with a brief, <em>not just a chart.</em></h2>
          <p>Reviewed evidence, implementation context, explicit scenario assumptions, data needs and next steps—assembled with their boundaries intact.</p>
          <Link className="button overview-closing-cta" to="/brief">Open the Planning Brief <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="overview-paper-illustration" aria-hidden="true">
          <span className="overview-paper-sheet back" />
          <span className="overview-paper-sheet middle" />
          <span className="overview-paper-sheet front">
            <i className="paper-mark" /><i className="paper-line title" /><i className="paper-line" />
            <i className="paper-line short" /><i className="paper-bar" />
            <i className="paper-line" /><i className="paper-line" /><i className="paper-line short" />
          </span>
        </div>
      </section>
    </section>
  );
}
