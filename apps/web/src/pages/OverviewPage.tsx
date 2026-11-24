import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { useArtifact } from "../data/ArtifactContext";
import { COVERAGE_CATALOG, type CoverageCatalogEntry } from "../data/coverageCatalog";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { createPilotInputDraft } from "../data/pilotInputDraft";
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import { createPlanningScenarioDefaults } from "../data/planningScenarioDefaults";
import { AppleDetailModal } from "../components/AppleDetailModal";
import "./OverviewPage.css";

const integers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function OverviewPage() {
  const navigate = useNavigate();
  const { bundle, localContext, localContextStatus, scenario, setScenario, setPilotInputDraft } = useArtifact();

  const baseScenario = useMemo(() => scenario ?? createPlanningScenarioDefaults(), [scenario]);
  const [teaserReachPct, setTeaserReachPct] = useState(() => Math.round(baseScenario.reach * 100));
  const [realityModalOpen, setRealityModalOpen] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<CoverageCatalogEntry | null>(null);

  const teaserScenario = useMemo(
    () => ({ ...baseScenario, reach: Math.max(0.05, Math.min(0.5, teaserReachPct / 100)) }),
    [baseScenario, teaserReachPct]
  );

  const teaserResult = useMemo(() => {
    try {
      return calculateScenario(teaserScenario);
    } catch {
      return null;
    }
  }, [teaserScenario]);

  const measures = useMemo(
    () => bundle?.burden_domains.flatMap(domain => domain.measures).filter(canExportEstimate) ?? [],
    [bundle]
  );

  const meanSpending = measures.find(m => m.estimate_id === "meps24-gross-all-cause-spending-mean");
  const adminTime = measures.find(m => m.estimate_id === "meps24-healthcare-paperwork-time-mean");
  const localCount = localContextStatus === "loaded" ? localContext?.indicators.length ?? 0 : 0;

  const capacityCoveragePct = teaserResult && teaserResult.intended_reach > 0
    ? Math.min(100, Math.round((teaserResult.reached_participants / teaserResult.intended_reach) * 100))
    : 100;
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - capacityCoveragePct / 100);

  const openInSimulate = () => {
    setScenario(teaserScenario);
    setPilotInputDraft(createPilotInputDraft(teaserScenario));
    navigate("/pilot");
  };

  return (
    <section className="page page-stack overview-cupertino">
      <header className="cupertino-hero">
        <p className="apple-kicker">Edition 01 · Long COVID · West Virginia</p>
        <h1>Health costs, finally clear.</h1>
        <p className="cupertino-subtitle">
          National evidence, local terrain, and pilot math—kept strictly separate.
        </p>
        <div className="cupertino-hero-ctas">
          <Link className="button" to="/burden">Start Exploring</Link>
          <Link className="button secondary" to="/pilot">Try Simulator</Link>
        </div>
      </header>

      <div className="bento-grid" aria-label="Interactive workspace overview">
        {/* 1. Interactive 1-slider Strategy Simulator card */}
        <article className="apple-card bento-simulator">
          <div className="bento-card-head">
            <div>
              <p className="bento-eyebrow amber">Strategy Simulator</p>
              <h2>Test program reach live</h2>
            </div>
            <span className="status status-assumption mono-figure">{teaserReachPct}% reach</span>
          </div>

          <div className="bento-sim-body">
            <div className="bento-ring-wrap" aria-hidden="true">
              <svg viewBox="0 0 120 120" className="bento-ring-svg">
                <circle cx="60" cy="60" r={ringRadius} className="bento-ring-track" />
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  className="bento-ring-fill"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="57" textAnchor="middle" className="bento-ring-value">{capacityCoveragePct}%</text>
                <text x="60" y="73" textAnchor="middle" className="bento-ring-label">capacity fit</text>
              </svg>
            </div>

            <div className="bento-sim-metrics">
              <div className="bento-stat">
                <span>Program budget</span>
                <strong className="mono-figure">
                  {teaserResult ? formatPlanningCurrency(teaserResult.program_resource_requirement) : "—"}
                </strong>
              </div>
              <div className="bento-stat">
                <span>Served within capacity</span>
                <strong className="mono-figure">
                  {teaserResult ? formatPlanningNumber(teaserResult.reached_participants, integers) : "—"}
                </strong>
              </div>
            </div>
          </div>

          <label className="bento-slider-control" htmlFor="overview-reach-slider">
            <span>Adjust target reach ({formatPlanningNumber(teaserScenario.eligible_population, integers)} eligible)</span>
            <input
              id="overview-reach-slider"
              className="apple-slider"
              type="range"
              min={5}
              max={50}
              step={1}
              value={teaserReachPct}
              aria-valuetext={`${teaserReachPct}% reach`}
              onChange={event => setTeaserReachPct(Number(event.target.value))}
            />
          </label>

          <div className="bento-card-foot">
            <p className="micro-caption">Planning math · Not savings</p>
            <button type="button" className="text-button" onClick={openInSimulate}>
              Open in Simulate →
            </button>
          </div>
        </article>

        {/* 2. Giant Live Reality card */}
        <article className="apple-card bento-reality">
          <div className="bento-card-head">
            <div>
              <p className="bento-eyebrow cobalt">2024 MEPS Reality</p>
              <h2>Observed national burden</h2>
            </div>
            <button
              type="button"
              className="apple-info-btn"
              aria-label="Inspect national burden provenance and limits"
              onClick={() => setRealityModalOpen(true)}
            >
              i
            </button>
          </div>

          <div className="bento-reality-stats">
            <div className="bento-giant-metric">
              <strong className="mono-figure">
                {meanSpending ? formatEstimateValue(meanSpending) : "—"}
              </strong>
              <span>Mean annual all-cause spending</span>
            </div>
            <div className="bento-giant-metric">
              <strong className="mono-figure">
                {adminTime ? formatEstimateValue(adminTime) : "—"}
              </strong>
              <span>Annual bills &amp; insurance time</span>
            </div>
          </div>

          <div className="bento-card-foot">
            <p className="micro-caption">National descriptive · Not causal</p>
            <Link className="text-button" to="/burden">All {measures.length} measures →</Link>
          </div>
        </article>

        {/* 3. Edition Pill Rail */}
        <article className="apple-card bento-editions" aria-label="Platform editions">
          <div className="bento-editions-head">
            <p className="bento-eyebrow">Platform Editions</p>
            <span className="micro-caption">Zero cross-condition borrowing</span>
          </div>
          <div className="edition-pill-rail" role="list">
            {COVERAGE_CATALOG.map(entry => (
              <button
                key={entry.id}
                type="button"
                role="listitem"
                className={`edition-pill${entry.status === "live" ? " is-live" : ""}`}
                onClick={() => setSelectedEdition(entry)}
              >
                <span className="edition-pill-title">
                  {entry.id === "edition-01-long-covid"
                    ? "Long COVID · WV"
                    : entry.id === "additional-geographies"
                      ? "More States"
                      : entry.id === "complex-chronic-pathways"
                        ? "Chronic Care"
                        : entry.title}
                </span>
                <span className={`edition-pill-badge${entry.status === "live" ? " live" : ""}`}>
                  {entry.status === "live" ? "Live" : "Soon"}
                </span>
              </button>
            ))}
          </div>
        </article>

        {/* 4. Three crisp feature tiles (<= 10 words each) */}
        <Link to="/burden" className="apple-card bento-tile">
          <p className="bento-eyebrow cobalt">Costs</p>
          <h3>National burden</h3>
          <p>{measures.length || 21} reviewed MEPS measures with 95% intervals.</p>
        </Link>

        <Link to="/local-context" className="apple-card bento-tile">
          <p className="bento-eyebrow reviewed">Terrain</p>
          <h3>Local access</h3>
          <p>{localCount || 34} West Virginia HRSA and ACS indicators.</p>
        </Link>

        <Link to="/brief" className="apple-card bento-tile">
          <p className="bento-eyebrow indigo">Brief &amp; AI</p>
          <h3>Actionable deck</h3>
          <p>Export PDF, JSON, or Strategy AI prompts.</p>
        </Link>
      </div>

      {/* Live Reality provenance modal */}
      <AppleDetailModal
        open={realityModalOpen}
        kicker="2024 MEPS · National Descriptive Evidence"
        title="Observed burden provenance"
        onClose={() => setRealityModalOpen(false)}
      >
        <p>
          These figures come directly from reviewed 2024 Medical Expenditure Panel Survey (MEPS) estimates.
          They are never rescaled by West Virginia indicators or simulator assumptions.
        </p>
        <dl className="apple-detail-list">
          {meanSpending && (
            <div>
              <dt>{meanSpending.label}</dt>
              <dd>{formatEstimateValue(meanSpending)} ({formatEstimateInterval(meanSpending)}) · {meanSpending.source_ref}</dd>
            </div>
          )}
          {adminTime && (
            <div>
              <dt>{adminTime.label}</dt>
              <dd>{formatEstimateValue(adminTime)} ({formatEstimateInterval(adminTime)}) · {adminTime.source_ref}</dd>
            </div>
          )}
          <div>
            <dt>Boundary</dt>
            <dd>All-cause spending and time are descriptive; they do not measure Long COVID-attributable cost or savings.</dd>
          </div>
        </dl>
      </AppleDetailModal>

      {/* Edition catalog modal */}
      <AppleDetailModal
        open={selectedEdition !== null}
        kicker={selectedEdition?.editionLabel}
        title={selectedEdition?.title ?? ""}
        onClose={() => setSelectedEdition(null)}
      >
        {selectedEdition && (
          <>
            <p>{selectedEdition.plannedScope}</p>
            <dl className="apple-detail-list">
              <div>
                <dt>Status</dt>
                <dd>{selectedEdition.badgeLabel}</dd>
              </div>
              <div>
                <dt>Scope &amp; geography</dt>
                <dd>{selectedEdition.geographyLabel}</dd>
              </div>
              <div>
                <dt>Scientific boundary</dt>
                <dd>{selectedEdition.whyNotBorrowed}</dd>
              </div>
              {selectedEdition.sourceHighlights.length > 0 && (
                <div>
                  <dt>Reviewed sources</dt>
                  <dd>{selectedEdition.sourceHighlights.join(" · ")}</dd>
                </div>
              )}
              <div>
                <dt>Limitations</dt>
                <dd>{selectedEdition.limitations.join(" ")}</dd>
              </div>
            </dl>
          </>
        )}
      </AppleDetailModal>
    </section>
  );
}
