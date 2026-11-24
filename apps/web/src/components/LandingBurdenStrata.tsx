import { useEffect, useMemo, useRef, useState } from "react";
import { canDisplayDistributionSummary, canExportEstimate, type ArtifactBundle, type Estimate } from "@diagnostic-odyssey/contracts";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import "./LandingBurdenStrata.css";

interface StrataBeat {
  readonly id: "1" | "2" | "3";
  readonly eyebrow: string;
  readonly figure: string;
  readonly graphic: StrataGraphic | null;
  readonly headline: string;
  readonly summary: string;
  readonly surveyLayer: string;
  readonly surveySublabel: string;
  readonly strataClass: "is-spending" | "is-admin" | "is-distress";
}

interface StrataGraphic {
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly interval: string | null;
  readonly bounds: readonly [number, number] | null;
  readonly point: number;
}

function validNonnegativeValue(value: unknown, unit: string): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && (unit !== "proportion" || value <= 1);
}

function getExportableMap(bundle: ArtifactBundle | null): Map<string, Estimate> {
  const entries = (bundle?.burden_domains ?? [])
    .flatMap(domain => domain.measures)
    .filter(estimate => canExportEstimate(estimate) && validNonnegativeValue(estimate.value, estimate.unit))
    .map(estimate => [estimate.estimate_id, estimate] as const);
  return new Map(entries);
}

function formatHourFigure(estimate: Estimate | undefined): string {
  if (!estimate || typeof estimate.value !== "number") return "Estimate unavailable";
  return `${estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} hrs`;
}

const SVG_W = 360;

function strataGraphic(
  estimate: Estimate | undefined,
  unit: string,
  step: number,
  minMax: number,
  formatAxis: (value: number) => string
): StrataGraphic | null {
  if (!estimate || estimate.unit !== unit || !validNonnegativeValue(estimate.value, unit)) return null;

  const { value, interval_low: low, interval_high: high } = estimate;
  const hasInterval = validNonnegativeValue(low, unit) && validNonnegativeValue(high, unit)
    && low <= value && value <= high && Boolean(estimate.interval_type?.trim());
  const maximum = unit === "proportion" ? 1
    : Math.max(minMax, Math.ceil((hasInterval ? high : value) / step) * step);
  if (!Number.isFinite(maximum)) return null;
  const position = (number: number) => (number / maximum) * SVG_W;

  return {
    minLabel: formatAxis(0),
    maxLabel: formatAxis(maximum),
    interval: hasInterval ? formatEstimateInterval(estimate) : null,
    bounds: hasInterval ? [position(low), position(high)] : null,
    point: position(value)
  };
}

function WhiskerSvg({ graphic, figure, label }: { graphic: StrataGraphic; figure: string; label: string }) {
  return (
    <svg
      className="strata-whisker-svg"
      viewBox={`-6 0 ${SVG_W + 12} 24`}
      role="img"
      aria-label={`${label}: ${figure}${graphic.interval ? `, ${graphic.interval}` : ""}`}
    >
      <rect x="0" y="9" width={SVG_W} height="6" rx="3" className="strata-whisker-track" />
      <line x1={SVG_W * 0.25} y1="4" x2={SVG_W * 0.25} y2="20" className="strata-whisker-tick" />
      <line x1={SVG_W * 0.5} y1="4" x2={SVG_W * 0.5} y2="20" className="strata-whisker-tick" />
      <line x1={SVG_W * 0.75} y1="4" x2={SVG_W * 0.75} y2="20" className="strata-whisker-tick" />
      {graphic.bounds && (graphic.bounds[0] === graphic.bounds[1]
        ? <line x1={graphic.bounds[0]} x2={graphic.bounds[0]} y1="3" y2="21" className="strata-whisker-tick" />
        : <rect x={graphic.bounds[0]} y="9" width={graphic.bounds[1] - graphic.bounds[0]} height="6" rx="3" className="strata-whisker-range" />
      )}
      <circle cx={graphic.point} cy="12" r="5.5" className="strata-whisker-point" />
    </svg>
  );
}

/**
 * Chapters II & III: Three memorable reviewed national figures in separate survey layers,
 * accompanied on desktop by a signature sticky "Unfolding Evidence Strata" panel that
 * highlights each outcome and its native unit as the visitor scrolls.
 */
export function LandingBurdenStrata({ bundle }: { bundle: ArtifactBundle | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeBeat, setActiveBeat] = useState<"1" | "2" | "3">("1");

  const byId = useMemo(() => getExportableMap(bundle), [bundle]);

  const pop = byId.get("meps24-current-long-covid-population");
  const spendTotal = byId.get("meps24-gross-all-cause-spending-total");
  const spendMean = byId.get("meps24-gross-all-cause-spending-mean");
  const oopMean = byId.get("meps24-out-of-pocket-spending-mean");
  const oopTotal = byId.get("meps24-out-of-pocket-spending-total");

  const paperwork = byId.get("meps24-healthcare-paperwork-time-mean");
  const billsTime = byId.get("meps24-medical-bills-insurance-time-mean");
  const visitsTime = byId.get("meps24-own-medical-visit-time-mean");
  const priorAuth = byId.get("meps24-prior-approval-denied-delayed");

  const k6Serious = byId.get("meps24-k6-serious-distress");
  const phq2Pos = byId.get("meps24-phq2-screen-positive");

  const beats = useMemo<readonly StrataBeat[]>(() => {
    const popScope = pop
      ? `The national population estimate is ${formatEstimateValue(pop)} (${formatEstimateInterval(pop)}).`
      : "";
    const spending = strataGraphic(spendTotal, "USD/year", 25e9, 150e9, value => value === 0 ? "$0" : `$${value / 1e9}B`);
    const admin = strataGraphic(paperwork, "hours/person/year", 10, 50, value => `${value} hrs`);
    const distress = strataGraphic(k6Serious, "proportion", 1, 1, value => `${value * 100}%`);

    return [
      {
        id: "1",
        eyebrow: "01 · FINANCIAL SCALE",
        figure: spending && spendTotal ? formatEstimateValue(spendTotal) : "Estimate unavailable",
        graphic: spending,
        headline: "In annual gross all-cause medical spending.",
        summary: `Calendar-year 2024 spending across all causes and payers for U.S. civilian noninstitutionalized adults ages 18–64 classified as operational-current Long COVID at their Round 3/1 interview, with valid annual spending data. ${popScope} This descriptive total cannot quantify spending attributable to illness, avoidable costs, or potential savings.`,
        surveyLayer: "MEPS 2024 full-year spending",
        surveySublabel: "Adults ages 18–64 · USD/year across all payers",
        strataClass: "is-spending"
      },
      {
        id: "2",
        eyebrow: "02 · PAPERWORK & NAVIGATION",
        figure: formatHourFigure(admin ? paperwork : undefined),
        graphic: admin,
        headline: "Survey-weighted mean annualized hours per person per year for health care paperwork and navigation.",
        summary: "Eligible later MEPS ESAQ respondents, ages 18–64, with valid paperwork responses and positive survey weights, had been classified as operational-current Long COVID at the earlier 2024 Round 3/1 interview. The later supplement cannot establish continued current status.",
        surveyLayer: "MEPS 2024 ESAQ respondents",
        surveySublabel: "Survey-weighted annualized mean · hours/person/year",
        strataClass: "is-admin"
      },
      {
        id: "3",
        eyebrow: "03 · PSYCHOLOGICAL DISTRESS",
        figure: distress && k6Serious ? formatEstimateValue(k6Serious) : "Estimate unavailable",
        graphic: distress,
        headline: "Met the K6 screening threshold for serious nonspecific distress.",
        summary: "Eligible later MEPS PSAQ respondents, ages 18–64, with valid K6 scores and positive survey weights, had been classified as operational-current Long COVID at the earlier 2024 Round 3/1 interview. The later supplement cannot establish continued current status. A K6 score of 13 or higher indicates serious distress on a screening scale. Diagnosis requires clinical assessment.",
        surveyLayer: "MEPS 2024 PSAQ respondents",
        surveySublabel: "Weighted proportion · K6 ≥ 13 screen",
        strataClass: "is-distress"
      }
    ];
  }, [pop, spendTotal, paperwork, k6Serious]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-beat-id]"));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            const beatId = entry.target.dataset.beatId;
            if (beatId === "1" || beatId === "2" || beatId === "3") {
              setActiveBeat(beatId);
            }
          }
        }
      },
      {
        rootMargin: "-26% 0px -48% 0px",
        threshold: 0.12
      }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const paperworkDistribution = beats[1]?.graphic && paperwork && canDisplayDistributionSummary(paperwork)
    ? paperwork.distribution_summary
    : undefined;

  return (
    <section
      id="story-burden"
      ref={containerRef}
      className="atlas-burden-chapter"
      aria-labelledby="story-burden-title"
    >
      <div className="atlas-band-inner">
        <div className="atlas-burden-intro" data-reveal="auto">
          <p className="eyebrow">01 · THE BURDEN IN THREE SEPARATE MEASURES</p>
          <h2 id="story-burden-title">
            Three measures describe <em>different dimensions of burden.</em>
          </h2>
          <p className="subtle">
            These AHRQ MEPS 2024 estimates describe finances, administrative time, and distress. The outcome-specific respondent samples may overlap.
          </p>
        </div>

        <div className="atlas-strata-split">
          <div className="atlas-strata-beats">
            {beats.map(beat => (
              <article
                key={beat.id}
                data-beat-id={beat.id}
                className={`atlas-beat-card ${beat.strataClass}${activeBeat === beat.id ? " is-active" : ""}`}
                data-reveal="auto"
              >
                <p className="atlas-beat-eyebrow">{beat.eyebrow}</p>
                <strong className={`atlas-beat-figure${beat.graphic ? "" : " is-unavailable"}`}>{beat.figure}</strong>
                {beat.graphic?.interval && (
                  <p className="atlas-beat-ci">{beat.graphic.interval}</p>
                )}
                <h3>{beat.headline}</h3>
                {beat.id === "2" && paperworkDistribution && (
                  <p className="atlas-beat-summary">
                    <strong>Survey-weighted median: {paperworkDistribution.p50} hours per person per year.</strong>{" "}
                    The middle half reported {paperworkDistribution.p25}–{paperworkDistribution.p75} annualized hours.
                    That range describes responses. The confidence interval describes sampling uncertainty around the mean.
                  </p>
                )}
                <p className="atlas-beat-summary">{beat.summary}</p>

                {beat.graphic && (
                  <div className="atlas-beat-inline-whisker">
                    <WhiskerSvg graphic={beat.graphic} figure={beat.figure} label={beat.headline} />
                    <div className="atlas-beat-scale">
                      <span>{beat.graphic.minLabel}</span>
                      <span>{beat.surveyLayer}</span>
                      <span>{beat.graphic.maxLabel}</span>
                    </div>
                  </div>
                )}

                {beat.id === "1" && (spendMean || (beat.graphic && oopMean && oopTotal)) && (
                  <details className="strata-disclosure">
                    <summary>More spending context (nested &amp; per-person)</summary>
                    <ul>
                      {spendMean && (
                        <li>
                          Mean annual all-cause spending per person:{" "}
                          <strong>{formatEstimateValue(spendMean)}</strong> ({formatEstimateInterval(spendMean)}).
                        </li>
                      )}
                      {beat.graphic && oopMean && oopTotal && (
                        <li>
                          Out-of-pocket component (nested inside the {beat.figure} total, never added):{" "}
                          <strong>{formatEstimateValue(oopMean)}</strong> per person ({formatEstimateValue(oopTotal)} total; {formatEstimateInterval(oopTotal)}).
                        </li>
                      )}
                    </ul>
                  </details>
                )}

                {beat.id === "2" && (billsTime || visitsTime || priorAuth) && (
                  <details className="strata-disclosure">
                    <summary>Other questions about time and approvals</summary>
                    <ul>
                      {billsTime && (
                        <li>
                          Managing medical bills &amp; insurance:{" "}
                          <strong>{formatHourFigure(billsTime)}/yr</strong> ({formatEstimateInterval(billsTime)}).
                        </li>
                      )}
                      {visitsTime && (
                        <li>
                          Own medical visits &amp; prescriptions:{" "}
                          <strong>{formatHourFigure(visitsTime)}/yr</strong> ({formatEstimateInterval(visitsTime)}).
                        </li>
                      )}
                      {priorAuth && (
                        <li>
                          Prior approval denied or delayed (insured respondents who used services and answered yes or no):{" "}
                          <strong>{formatEstimateValue(priorAuth)}</strong> ({formatEstimateInterval(priorAuth)}).
                        </li>
                      )}
                    </ul>
                    <p className="strata-disclosure-note">
                      Each ESAQ question has its own eligibility and top-code rules. Read each estimate in its respondent scope. The time estimates cannot be added or compared on hours alone.
                    </p>
                  </details>
                )}

                {beat.id === "3" && (
                  <details className="strata-disclosure">
                    <summary>Additional PSAQ screen &amp; unavailable burden domains</summary>
                    <ul>
                      {phq2Pos && (
                        <li>
                          PHQ-2 depressive-symptom screen positive (score &ge; 3, screening measure only):{" "}
                          <strong>{formatEstimateValue(phq2Pos)}</strong> ({formatEstimateInterval(phq2Pos)}).
                        </li>
                      )}
                      <li>
                        <strong>Work &amp; Function:</strong> Measures in this domain remain unavailable in Edition 01—no proxy or substitute figures are shown.
                      </li>
                    </ul>
                  </details>
                )}
              </article>
            ))}
          </div>

          <aside className="atlas-strata-stage-col" aria-label="Outcome-specific survey estimates">
            <div className="atlas-strata-sticky" data-active-beat={activeBeat}>
              <div className="strata-stage-header">
                <span className="strata-stage-kicker">EVIDENCE ARCHITECTURE</span>
                <span className="strata-stage-badge">
                  Layer 0{activeBeat} of 03 active
                </span>
              </div>

              <div className="strata-layers-stack">
                {beats.map(beat => (
                  <div
                    key={beat.id}
                    className={`strata-layer ${beat.strataClass}${activeBeat === beat.id ? " is-focused" : ""}`}
                  >
                    <div className="strata-layer-top">
                      <div>
                        <span className="strata-layer-cohort">{beat.surveyLayer}</span>
                        <small className="strata-layer-unit">{beat.surveySublabel}</small>
                      </div>
                      <strong className={`strata-layer-val${beat.graphic ? "" : " is-unavailable"}`}>{beat.figure}</strong>
                    </div>
                    {beat.graphic && (
                      <>
                        <WhiskerSvg graphic={beat.graphic} figure={beat.figure} label={beat.surveyLayer} />
                        <div className="strata-layer-foot">
                          <span>{beat.graphic.minLabel}</span>
                          <span>{beat.graphic.interval}</span>
                          <span>{beat.graphic.maxLabel}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <p className="strata-stage-boundary">
                Outcome-specific samples may overlap. Read each estimate in its own units.
              </p>
            </div>
          </aside>
        </div>

        <p className="atlas-burden-bridge" data-reveal="auto">
          National estimates show the scale across the country. They cannot tell a state health department what capacity exists on the ground. <strong>That is where Diagnostic Odyssey begins.</strong>
        </p>
      </div>
    </section>
  );
}
