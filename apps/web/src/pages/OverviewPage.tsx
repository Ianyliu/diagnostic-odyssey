import { useState } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { formatEstimateValue } from "../data/formatEstimateValue";
import { LandingJourney } from "../components/LandingJourney";
import { StrategyTeaserSandbox } from "../components/StrategyTeaserSandbox";
import { EditionDrawer } from "../components/EditionDrawer";
import { useOpeningMotion } from "./OpeningProvenance";
import "./OverviewPage.css";

function heroFigure(estimate: Estimate): string {
  if (estimate.unit === "hours/person/year" && typeof estimate.value === "number") {
    return `${estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} hrs`;
  }
  return formatEstimateValue(estimate);
}

export function OverviewPage({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
  const opening = useOpeningMotion();
  const [editionOpen, setEditionOpen] = useState(false);
  const { bundle, localContext, localContextStatus } = useArtifact();

  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;

  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  const headlines = bundle ? selectHeadlineFindings(bundle) : [];

  return (
    <div className={"overview-page" + (opening.playing ? " is-opening" : "")}>
      {/* Band 1: Full-bleed Midnight Ink Hero */}
      <section className="atlas-hero-band" aria-labelledby="overview-title">
        <div className="atlas-hero-grid" aria-hidden="true" />
        <div className="atlas-band-inner atlas-first-screen">
          <div className="atlas-hero-header">
            <p className="atlas-hero-eyebrow">Edition 01 · Long COVID (U.S.) · West Virginia</p>
            <h1 id="overview-title" className="atlas-hero-title">
              See the burden. <em>Find the leverage.</em>
            </h1>
            <p className="atlas-hero-sub">
              Understand the hidden burden of illness. Investigate local constraints and plan a feasible response with evidence and assumptions kept separate.
            </p>
            <div className="atlas-hero-ctas">
              <Link className="button" to="/burden">
                Explore evidence <span aria-hidden="true">→</span>
              </Link>
              <Link className="atlas-ghost-cta" to="/pilot">
                Open Strategy Lab
              </Link>
              {advisorAvailable && <Link className="atlas-ghost-cta" to="/advisor">
                Strategy AI
              </Link>}
            </div>
          </div>

          <div className="atlas-hero-pathway">
            <LandingJourney />
          </div>
        </div>
      </section>

      <div className="atlas-sandbox-band">
        <div className="atlas-band-inner"><StrategyTeaserSandbox /></div>
      </div>

      {/* Band 2: Cool Gallery Paper — Monumental Two-Lens Showcase */}
      <section className="atlas-paper-band" aria-labelledby="overview-lenses-title">
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
              <p>Spending, time, and distress; uncertainty displayed where available.</p>
              <span className="atlas-lens-link">Open Costs ↗</span>
            </Link>

            <span className="atlas-never-blended" aria-label="National and local data are never combined into a single score">
              Never blended
            </span>

            <Link to="/local-context" className="atlas-lens-card is-local">
              <span className="atlas-lens-kicker">HRSA &amp; Census ACS · West Virginia</span>
              <strong className="atlas-lens-figure">{localIndicatorCount ?? "—"}</strong>
              <h3>Local terrain indicators</h3>
              <p>Care supply, broadband, and transit conditions.</p>
              <span className="atlas-lens-link">Open Terrain ↗</span>
            </Link>
          </div>

          {headlines.length > 0 && (
            <div className="atlas-metrics-strip" aria-label="Key national figures">
              {headlines.map(({ spec, estimate }) => (
                <div className="atlas-metric-pill" key={spec.estimateId}>
                  <strong>{heroFigure(estimate)}</strong>
                  <span>{estimate.label}</span>
                </div>
              ))}
              <p className="micro-caption atlas-strip-caption">National descriptive · Not causal</p>
            </div>
          )}

          <div className="atlas-editions-bar" aria-label="Platform editions">
            <div className="atlas-editions-chips">
              {COVERAGE_CATALOG.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className={`atlas-edition-chip ${entry.status === "live" ? "is-live" : "is-soon"}`}
                  onClick={() => setEditionOpen(true)}
                >
                  <span>{entry.status === "live" ? "Live" : "Soon"}</span>
                  <strong>{entry.title}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="text-button" onClick={() => setEditionOpen(true)}>
              Edition details ▾
            </button>
          </div>
        </div>
      </section>

      {/* Band 3: Midnight Ink Closing — Tactile Fanned Brief Finale */}
      <section className="atlas-closing-band" aria-labelledby="overview-closing-title">
        <div className="atlas-band-inner atlas-closing-grid">
          <div className="atlas-closing-copy">
            <p className="atlas-hero-eyebrow">EXECUTIVE BRIEF</p>
            <h2 id="overview-closing-title">Leave with a defensible brief.</h2>
            <p>Reviewed metrics, selected terrain, and explicit pilot math.</p>
            <div className="atlas-hero-ctas">
              <Link className="button" to="/brief">
                Open Brief <span aria-hidden="true">→</span>
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

      <EditionDrawer open={editionOpen} onClose={() => setEditionOpen(false)} />
    </div>
  );
}
