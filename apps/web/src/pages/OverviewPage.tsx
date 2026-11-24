import { useRef } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { LandingCareHorizon } from "../components/LandingCareHorizon";
import { LandingBurdenStrata } from "../components/LandingBurdenStrata";
import { LandingJourney } from "../components/LandingJourney";
import { StrategyTeaserSandbox } from "../components/StrategyTeaserSandbox";
import { LandingAiDemo } from "../components/LandingAiDemo";
import { useEditionDrawer } from "../components/EditionDrawerContext";
import { useOpeningMotion, OpeningMotionContext } from "./OpeningProvenance";
import { useScrollReveal } from "./useScrollReveal";
import "./OverviewPage.css";

/**
 * Strategic Atlas Landing Page — Direction A ("Atlas Unfolded")
 * Six-chapter light-first, scroll-driven product introduction:
 *   I.   The Hook (porcelain canvas, question hook + 2.6s Care Horizon)
 *   II–III. Burden Scale & Human Cost (sticky 3-strata survey-layer separation)
 *   IV.  Introduce Diagnostic Odyssey (inset rounded navy stage + independent 3.8s pathway)
 *   V.   How It Works (Two Lenses kept apart + live deterministic Strategy Sandbox + Governed AI Demo)
 *   VI.  The Result (inset rounded navy Planning Brief finale with scroll-unfurling paper fan)
 */
export function OverviewPage({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const opening = useOpeningMotion();
  useScrollReveal(pageRef);
  const { openEdition } = useEditionDrawer();
  const { bundle, localContext, localContextStatus } = useArtifact();

  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;

  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  return (
    <OpeningMotionContext.Provider value={opening}>
      <div ref={pageRef} className={"overview-page" + (opening.playing ? " is-opening" : "")}>
        <div className="atlas-scroll-progress" aria-hidden="true" />

        {/* Chapter I — Light Porcelain Hook (No enclosing blue hero wall) */}
        <section className="atlas-hero-band" aria-labelledby="overview-title">
          <div className="atlas-hero-atmosphere" aria-hidden="true" />
          <div className="atlas-band-inner atlas-first-screen">
            <div className="atlas-hero-header">
              <p className="atlas-hero-eyebrow">Long COVID · U.S. Public-Health Planning</p>
              <h1 id="overview-title" className="atlas-hero-title">
                What does chronic illness <em>really cost us?</em>
              </h1>
              <p className="atlas-hero-sub">
                Beyond medical bills and clinic visits, long-term illness brings unseen hours of paperwork and real psychological strain. Diagnostic Odyssey helps public-health teams see the evidence clearly—and plan care that fits local ground.
              </p>
              <div className="atlas-hero-ctas">
                <a className="button" href="#story-burden">
                  Read the story <span aria-hidden="true">↓</span>
                </a>
                <Link className="atlas-quiet-cta" to="/burden">
                  Enter workspace <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <LandingCareHorizon />

            <p className="atlas-hero-provenance">
              <span>Grounded in <strong>AHRQ MEPS</strong> · <strong>HRSA</strong> · <strong>Census ACS</strong></span>
              <span>National burden, local access, and pilot assumptions never blended</span>
            </p>
          </div>
        </section>

        {/* Chapters II & III — Three Memorable Figures + Signature Sticky Evidence Strata */}
        <LandingBurdenStrata bundle={bundle} />

        {/* Chapter IV — Introduce Diagnostic Odyssey: Inset Rounded Midnight Navy Stage */}
        <section className="atlas-pathway-section" aria-labelledby="overview-pathway-title" data-reveal="auto">
          <div className="atlas-band-inner">
            <div className="atlas-inset-stage">
              <div className="atlas-stage-grid" aria-hidden="true" />
              <div className="atlas-stage-head">
                <p className="atlas-stage-eyebrow">DIAGNOSTIC ODYSSEY</p>
                <h2 id="overview-pathway-title" className="atlas-stage-title">
                  From data to <em>action.</em>
                </h2>
                <p className="atlas-stage-sub">
                  One structured workflow for public-health organizations—keeping reviewed national evidence, statewide access conditions, pilot assumptions, and information gaps visibly separate from first question to final brief.
                </p>
              </div>

              <LandingJourney />
            </div>
          </div>
        </section>

        {/* Chapter V — Selective Product Demonstrations (One Clear Message Per Beat) */}
        <section className="atlas-paper-band" aria-labelledby="overview-lenses-title">
          <div className="atlas-band-inner atlas-showcase-stack">
            {/* Beat V-1: Two Lenses Kept Apart */}
            <div className="atlas-lenses-beat" data-reveal="auto">
              <div className="atlas-section-head">
                <p className="eyebrow">02 · TWO LENSES, KEPT APART</p>
                <h2 id="overview-lenses-title">
                  National reality. <em>Local ground.</em>
                </h2>
                <p className="subtle">
                  National descriptive data illuminates illness burden; statewide indicators illuminate delivery conditions. One never invents prevalence for the other.
                </p>
              </div>

              <div className="atlas-lenses-grid">
                <Link to="/burden" className="atlas-lens-card is-national">
                  <span className="atlas-lens-kicker">AHRQ MEPS · U.S. National</span>
                  <strong className="atlas-lens-figure">{reviewedCount || "—"}</strong>
                  <h3>Reviewed burden measures</h3>
                  <p>
                    Medical spending, healthcare utilization, administrative care time, and psychological distress across 3 populated domains (13 economic/healthcare, 4 administrative, 4 mental-health; work-loss measures remain unavailable).
                  </p>
                  <span className="atlas-lens-link">Open 01 Burden ↗</span>
                </Link>

                <span className="atlas-never-blended" aria-label="National and local data are never combined into a single score">
                  Never blended
                </span>

                <Link to="/local-context" className="atlas-lens-card is-local">
                  <span className="atlas-lens-kicker">HRSA &amp; Census ACS · Statewide West Virginia</span>
                  <strong className="atlas-lens-figure">{localIndicatorCount ?? "—"}</strong>
                  <h3>Statewide indicators from HRSA and Census ACS</h3>
                  <p>
                    Statewide West Virginia HRSA shortage designations (not people) and 2024 ACS insurance, broadband, poverty, and household vehicle indicators (no county-level data)—never local Long COVID prevalence.
                  </p>
                  <span className="atlas-lens-link">Open 02 Local context ↗</span>
                </Link>
              </div>

              <p className="micro-caption atlas-lenses-note">
                National descriptive · Not causal · All-cause estimates are not cost attributable to Long COVID alone
              </p>
            </div>

            {/* Beat V-2: Interactive Deterministic Strategy Sandbox */}
            <div className="atlas-sandbox-beat" data-reveal="auto">
              <StrategyTeaserSandbox />
            </div>

            {/* Beat V-3: Governed AI Handoff Demonstration */}
            <LandingAiDemo advisorAvailable={advisorAvailable} />
          </div>
        </section>

        {/* Chapter VI — The Result: Inset Rounded Navy Brief Finale */}
        <section className="atlas-closing-band" aria-labelledby="overview-closing-title" data-reveal="auto">
          <div className="atlas-band-inner">
            <div className="atlas-closing-frame">
              <div className="atlas-stage-grid" aria-hidden="true" />
              <div className="atlas-closing-grid">
                <div className="atlas-closing-copy">
                  <p className="atlas-stage-eyebrow">THE PLANNING BRIEF</p>
                  <h2 id="overview-closing-title">Walk into the room with a brief you can defend.</h2>
                  <p>
                    Reviewed national estimates, selected West Virginia terrain, explicit pilot assumptions, and open data requests—carried together with every boundary intact, ready to print or export as canonical JSON.
                  </p>
                  <div className="atlas-closing-ctas">
                    <Link className="button atlas-closing-primary" to="/brief">
                      Open Planning Brief <span aria-hidden="true">→</span>
                    </Link>
                    <Link className="atlas-ghost-cta" to="/burden">
                      Explore Burden
                    </Link>
                  </div>
                  <div className="atlas-closing-meta">
                    <Link to="/evidence">Evidence limits</Link>
                    <span aria-hidden="true">·</span>
                    <button type="button" className="atlas-edition-link" onClick={() => openEdition()}>
                      Edition 01: Long COVID · View roadmap ▾
                    </button>
                  </div>
                </div>

                <div className="atlas-paper-fan" aria-hidden="true">
                  <span className="fan-sheet back" />
                  <span className="fan-sheet middle" />
                  <span className="fan-sheet front">
                    <i className="fan-mark" />
                    <i className="fan-line title" />
                    <i className="fan-line" />
                    <i className="fan-line short" />
                    <i className="fan-rule" />
                    <i className="fan-bar" />
                    <i className="fan-line" />
                    <i className="fan-line short" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </OpeningMotionContext.Provider>
  );
}
