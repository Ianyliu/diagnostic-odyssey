import { useEffect, useMemo, useRef, useState } from "react";
import { canExportEstimate, type ArtifactBundle, type Estimate } from "@diagnostic-odyssey/contracts";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import "./LandingBurdenStrata.css";

interface StrataBeat {
  readonly id: "1" | "2" | "3";
  readonly eyebrow: string;
  readonly figure: string;
  readonly interval: string | null;
  readonly headline: string;
  readonly summary: string;
  readonly surveyLayer: string;
  readonly surveySublabel: string;
  readonly scaleMinLabel: string;
  readonly scaleMaxLabel: string;
  readonly lowRatio: number;
  readonly highRatio: number;
  readonly pointRatio: number;
  readonly strataClass: "is-spending" | "is-admin" | "is-distress";
}

function getExportableMap(bundle: ArtifactBundle | null): Map<string, Estimate> {
  if (!bundle) return new Map();
  const entries = bundle.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate)
    .map(estimate => [estimate.estimate_id, estimate] as const);
  return new Map(entries);
}

function formatHourFigure(estimate: Estimate | undefined): string {
  if (!estimate || typeof estimate.value !== "number") return "—";
  return `${estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} hrs`;
}

function ratio(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

function niceScaleMax(estimate: Estimate | undefined, step: number, floor: number): number {
  const high = typeof estimate?.interval_high === "number"
    ? estimate.interval_high
    : typeof estimate?.value === "number"
      ? estimate.value
      : floor;
  return Math.max(floor, Math.ceil(high / step) * step);
}

const SVG_W = 360;

function WhiskerSvg({
  beat,
  label
}: {
  beat: Pick<StrataBeat, "lowRatio" | "highRatio" | "pointRatio" | "figure" | "interval">;
  label: string;
}) {
  const x1 = Math.round(beat.lowRatio * SVG_W);
  const x2 = Math.round(beat.highRatio * SVG_W);
  const cx = Math.max(7, Math.min(SVG_W - 7, Math.round(beat.pointRatio * SVG_W)));
  const span = Math.max(4, x2 - x1);

  return (
    <svg
      className="strata-whisker-svg"
      viewBox={`0 0 ${SVG_W} 24`}
      role="img"
      aria-label={`${label}: ${beat.figure}${beat.interval ? `, ${beat.interval}` : ""}`}
    >
      <rect x="0" y="9" width={SVG_W} height="6" rx="3" className="strata-whisker-track" />
      <line x1={SVG_W * 0.25} y1="4" x2={SVG_W * 0.25} y2="20" className="strata-whisker-tick" />
      <line x1={SVG_W * 0.5} y1="4" x2={SVG_W * 0.5} y2="20" className="strata-whisker-tick" />
      <line x1={SVG_W * 0.75} y1="4" x2={SVG_W * 0.75} y2="20" className="strata-whisker-tick" />
      <rect x={x1} y="9" width={span} height="6" rx="3" className="strata-whisker-range" />
      <circle cx={cx} cy="12" r="5.5" className="strata-whisker-point" />
    </svg>
  );
}

/**
 * Chapters II & III: Three memorable reviewed national figures in separate survey layers,
 * accompanied on desktop by a signature sticky "Unfolding Evidence Strata" panel that
 * physically separates each cohort and native unit as the visitor scrolls.
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
    const popVal = pop ? formatEstimateValue(pop) : "—";
    const popCi = pop ? formatEstimateInterval(pop) : null;

    const spendVal = spendTotal ? formatEstimateValue(spendTotal) : "—";
    const spendCi = spendTotal ? formatEstimateInterval(spendTotal) : null;

    const paperVal = formatHourFigure(paperwork);
    const paperCi = paperwork ? formatEstimateInterval(paperwork) : null;

    const k6Val = k6Serious ? formatEstimateValue(k6Serious) : "—";
    const k6Ci = k6Serious ? formatEstimateInterval(k6Serious) : null;

    const spendScaleMax = niceScaleMax(spendTotal, 25e9, 150e9);
    const paperScaleMax = niceScaleMax(paperwork, 10, 50);
    const k6ScaleMax = niceScaleMax(k6Serious, 0.05, 0.25);

    return [
      {
        id: "1",
        eyebrow: "01 · FINANCIAL SCALE",
        figure: spendVal,
        interval: spendCi,
        headline: "In annual gross all-cause medical spending.",
        summary: `Across ${popVal} U.S. adults ages 18–64 (${popCi ?? "MEPS 2024"}) meeting the operational current Long COVID definition at their Round 3/1 interview. This is descriptive gross spending across all payers and all causes—never illness-attributable cost, avoidable spending, or potential savings.`,
        surveyLayer: "MEPS 2024 Full-Year Cohort",
        surveySublabel: "Adults ages 18–64 · USD/year across all payers",
        scaleMinLabel: "$0",
        scaleMaxLabel: `$${Math.round(spendScaleMax / 1e9)}B`,
        lowRatio: ratio(spendTotal?.interval_low, spendScaleMax),
        highRatio: ratio(spendTotal?.interval_high, spendScaleMax),
        pointRatio: ratio(spendTotal?.value, spendScaleMax),
        strataClass: "is-spending"
      },
      {
        id: "2",
        eyebrow: "02 · PAPERWORK & NAVIGATION",
        figure: paperVal,
        interval: paperCi,
        headline: "Annualized health care paperwork and navigation time per person.",
        summary: "Measured in a later 2024 MEPS supplemental survey (ESAQ) among eligible respondents with valid paperwork time—reported strictly in native annualized hours per year. Supplement timing is later than the Round 3/1 status anchor.",
        surveyLayer: "MEPS 2024 ESAQ Subsample",
        surveySublabel: "Outcome-specific respondents · hours/person/year",
        scaleMinLabel: "0 hrs",
        scaleMaxLabel: `${paperScaleMax} hrs`,
        lowRatio: ratio(paperwork?.interval_low, paperScaleMax),
        highRatio: ratio(paperwork?.interval_high, paperScaleMax),
        pointRatio: ratio(paperwork?.value, paperScaleMax),
        strataClass: "is-admin"
      },
      {
        id: "3",
        eyebrow: "03 · PSYCHOLOGICAL DISTRESS",
        figure: k6Val,
        interval: k6Ci,
        headline: "Met the K6 screening threshold for serious nonspecific distress.",
        summary: "From the separate 2024 MEPS PSAQ supplement, which uses its own respondent sample and survey weights distinct from ESAQ and full-year spending. K6 ≥ 13 is a screening threshold, not a clinical psychiatric diagnosis.",
        surveyLayer: "MEPS 2024 PSAQ Subsample",
        surveySublabel: "Distinct survey weights · K6 ≥ 13 screen",
        scaleMinLabel: "0%",
        scaleMaxLabel: `${Math.round(k6ScaleMax * 100)}%`,
        lowRatio: ratio(k6Serious?.interval_low, k6ScaleMax),
        highRatio: ratio(k6Serious?.interval_high, k6ScaleMax),
        pointRatio: ratio(k6Serious?.value, k6ScaleMax),
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
            Each number lives in its own survey layer. <em>None are combined.</em>
          </h2>
          <p className="subtle">
            Three reviewed AHRQ MEPS 2024 estimates capture distinct dimensions of burden—financial, administrative, and psychological—across separate respondent universes and native units.
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
                <strong className="atlas-beat-figure">{beat.figure}</strong>
                {beat.interval && (
                  <p className="atlas-beat-ci">{beat.interval}</p>
                )}
                <h3>{beat.headline}</h3>
                <p className="atlas-beat-summary">{beat.summary}</p>

                {/* Inline whisker for tablet/mobile where sticky panel collapses */}
                <div className="atlas-beat-inline-whisker">
                  <WhiskerSvg beat={beat} label={beat.headline} />
                  <div className="atlas-beat-scale">
                    <span>{beat.scaleMinLabel}</span>
                    <span>{beat.surveyLayer}</span>
                    <span>{beat.scaleMaxLabel}</span>
                  </div>
                </div>

                {beat.id === "1" && (spendMean || oopMean) && (
                  <details className="strata-disclosure">
                    <summary>More spending context (nested &amp; per-person)</summary>
                    <ul>
                      {spendMean && (
                        <li>
                          Mean annual all-cause spending per person:{" "}
                          <strong>{formatEstimateValue(spendMean)}</strong> ({formatEstimateInterval(spendMean)}).
                        </li>
                      )}
                      {oopMean && oopTotal && (
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
                    <summary>Other separate ESAQ measures (distinct respondent universes)</summary>
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
                      Each ESAQ question reflects its own eligible respondent subset and top-code rules; annualized time measures are reported separately and never summed.
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

          <aside className="atlas-strata-stage-col" aria-label="Separate survey layers comparison">
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
                      <strong className="strata-layer-val">{beat.figure}</strong>
                    </div>
                    <WhiskerSvg beat={beat} label={beat.surveyLayer} />
                    <div className="strata-layer-foot">
                      <span>{beat.scaleMinLabel}</span>
                      <span>{beat.interval ?? "95% CI"}</span>
                      <span>{beat.scaleMaxLabel}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="strata-stage-boundary">
                Different cohorts · Native units preserved · Never combined into a single score
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
