import { useRef } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { LandingJourney } from "../components/LandingJourney";
import { StrategyTeaserSandbox } from "../components/StrategyTeaserSandbox";
import { useEditionDrawer } from "../components/EditionDrawerContext";
import { useOpeningMotion, OpeningMotionContext } from "./OpeningProvenance";
import { useScrollReveal } from "./useScrollReveal";
import "./OverviewPage.css";

function heroFigure(estimate: Estimate): string {
  if (estimate.unit === "hours/person/year" && typeof estimate.value === "number") {
    return estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return formatEstimateValue(estimate);
}

function accessibleInterval(text: string): string {
  return text
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");
}

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

  const headlines = bundle ? selectHeadlineFindings(bundle) : [];

  return (
    <OpeningMotionContext.Provider value={opening}>
    <div ref={pageRef} className={"overview-page" + (opening.playing ? " is-opening" : "")}>
      {/* Band 1: Full-bleed Midnight Navy Hero + Above-the-Fold Animated Pathway */}
      <section className="atlas-hero-band" aria-labelledby="overview-title">
        <div className="atlas-hero-grid" aria-hidden="true" />
        <div className="atlas-band-inner atlas-first-screen">
          <div className="atlas-hero-header">
            <p className="atlas-hero-eyebrow">Edition 01 · Long COVID (U.S.) · West Virginia</p>
            <h1 id="overview-title" className="atlas-hero-title">
              See the burden. <em>Find the leverage.</em>
            </h1>
            <p className="atlas-hero-sub">
              Understand the hidden burden of illness. Investigate local constraints and plan a feasible response with reviewed evidence and assumptions kept strictly separate.
            </p>
            <div className="atlas-hero-ctas">
              <Link className="button" to="/burden">
                Explore Burden <span aria-hidden="true">→</span>
              </Link>
              <Link className="atlas-ghost-cta" to="/pilot">
                Open Strategy Lab
              </Link>
              {advisorAvailable && (
                <Link className="atlas-ghost-cta" to="/advisor">
                  Prompt Studio
                </Link>
              )}
            </div>
          </div>

          <div className="atlas-hero-pathway">
            <LandingJourney />
          </div>

          <p className="atlas-hero-provenance">
            <span>Grounded in <strong>AHRQ MEPS</strong> · <strong>HRSA</strong> · <strong>Census ACS</strong></span>
            <span>National burden, local access, and pilot assumptions never blended</span>
          </p>
        </div>
      </section>

      <div className="atlas-sandbox-band" data-reveal="auto">
        <div className="atlas-band-inner"><StrategyTeaserSandbox /></div>
      </div>

      {/* Band 2: Cool Porcelain Paper — Monumental Two-Lens Showcase */}
      <section className="atlas-paper-band" aria-labelledby="overview-lenses-title" data-reveal="auto">
        <div className="atlas-band-inner atlas-lenses-section">
          <div className="atlas-section-head">
            <p className="eyebrow">TWO LENSES</p>
            <h2 id="overview-lenses-title">National reality. Local ground.</h2>
          </div>

          <div className="atlas-lenses-grid">
            <Link to="/burden" className="atlas-lens-card is-national">
              <span className="atlas-lens-kicker">AHRQ MEPS · U.S. National</span>
              <strong className="atlas-lens-figure">{reviewedCount || "—"}</strong>
              <h3>Reviewed burden measures</h3>
              <p>Medical spending, administrative time, health-status limitations, and psychological distress across 3 populated domains (work-loss measures remain unavailable).</p>
              <span className="atlas-lens-link">Open 01 Burden ↗</span>
            </Link>

            <span className="atlas-never-blended" aria-label="National and local data are never combined into a single score">
              Never blended
            </span>

            <Link to="/local-context" className="atlas-lens-card is-local">
              <span className="atlas-lens-kicker">HRSA &amp; Census ACS · West Virginia</span>
              <strong className="atlas-lens-figure">{localIndicatorCount ?? "—"}</strong>
              <h3>Local terrain indicators</h3>
              <p>Statewide West Virginia care supply, broadband, and transit conditions (no county-level data)—not local Long COVID prevalence.</p>
              <span className="atlas-lens-link">Open 02 Local context ↗</span>
            </Link>
          </div>

          {headlines.length > 0 && (
            <div className="atlas-metrics-strip" aria-label="Key national figures">
              {headlines.map(({ spec, estimate }) => {
                const interval = formatEstimateInterval(estimate);
                return (
                  <div className="atlas-metric-pill" key={spec.estimateId}>
                    <strong>{heroFigure(estimate)}</strong>
                    <span>{spec.label(estimate)}</span>
                    {interval && (
                      <small className="atlas-metric-ci">
                        <span aria-hidden="true">{interval}</span>
                        <span className="sr-only">{accessibleInterval(interval)}</span>
                      </small>
                    )}
                  </div>
                );
              })}
              <p className="micro-caption atlas-strip-caption">
                National descriptive · Not causal · All-cause estimates are not cost attributable to Long COVID alone
              </p>
            </div>
          )}

          <div className="atlas-grammar-strip" aria-label="Evidence-to-planning visual grammar">
            <div className="atlas-grammar-token is-evidence">
              <span className="atlas-grammar-swatch" aria-hidden="true" />
              <div>
                <strong>Reviewed national evidence</strong>
                <small>AHRQ MEPS 2024 survey-weighted estimates</small>
              </div>
            </div>
            <div className="atlas-grammar-token is-context">
              <span className="atlas-grammar-swatch" aria-hidden="true" />
              <div>
                <strong>Local terrain indicators</strong>
                <small>HRSA &amp; ACS access conditions (not prevalence)</small>
              </div>
            </div>
            <div className="atlas-grammar-token is-assumption">
              <span className="atlas-grammar-swatch" aria-hidden="true" />
              <div>
                <strong>Planner assumptions</strong>
                <small>Editable Strategy Lab arithmetic, never predictions</small>
              </div>
            </div>
            <div className="atlas-grammar-token is-gap">
              <span className="atlas-grammar-swatch" aria-hidden="true" />
              <div>
                <strong>Unfilled information gaps</strong>
                <small>Scoped into Data requests for external verification</small>
              </div>
            </div>
          </div>

          <div className="atlas-editions-bar" aria-label="Platform editions">
            <div className="atlas-editions-chips">
              {COVERAGE_CATALOG.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className={`atlas-edition-chip ${entry.status === "live" ? "is-live" : "is-soon"}`}
                  onClick={() => openEdition(entry.id)}
                >
                  <span>{entry.status === "live" ? "Live" : "Soon"}</span>
                  <strong>{entry.title}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="text-button" onClick={() => openEdition()}>
              Edition details ▾
            </button>
          </div>
        </div>
      </section>

      {/* Band 3: Midnight Navy Closing — Tactile Fanned Brief Finale */}
      <section className="atlas-closing-band" aria-labelledby="overview-closing-title" data-reveal="auto">
        <div className="atlas-band-inner atlas-closing-grid">
          <div className="atlas-closing-copy">
            <p className="atlas-hero-eyebrow">PLANNING BRIEF FINALE</p>
            <h2 id="overview-closing-title">Leave with a defensible brief.</h2>
            <p>Reviewed metrics, selected terrain, explicit pilot math, and open requests carried in one auditable export.</p>
            <div className="atlas-hero-ctas">
              <Link className="button" to="/brief">
                Open Planning Brief <span aria-hidden="true">→</span>
              </Link>
              <Link className="atlas-ghost-cta" to="/evidence">
                Evidence limits
              </Link>
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
              <i className="fan-bar" />
              <i className="fan-line" />
              <i className="fan-line short" />
            </span>
          </div>
        </div>
      </section>
    </div>
    </OpeningMotionContext.Provider>
  );
}
