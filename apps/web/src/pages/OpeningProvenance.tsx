import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import { formatPathwayStepLabel } from "../data/pathwayBoundary";
import {
  canReplayOpening,
  markOpeningSeen,
  OPENING_DURATION_MS,
  reducedMotionRequested,
  sessionStorageOrNull,
  shouldPlayOpening
} from "./openingMotion";
import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery } from "../browserMedia";

const documentEntry = typeof window !== "undefined" ? {
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash
} : { pathname: "/", search: "", hash: "" };

export function useOpeningMotion() {
  const [playing, setPlaying] = useState(() => shouldPlayOpening({
    ...documentEntry,
    reducedMotion: reducedMotionRequested(),
    storage: sessionStorageOrNull()
  }));
  const [runId, setRunId] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(reducedMotionRequested);
  const [announcement, setAnnouncement] = useState("");

  const replay = useCallback(() => {
    const prefersReduced = reducedMotionRequested();
    setReducedMotion(prefersReduced);
    if (!canReplayOpening(prefersReduced)) {
      setPlaying(false);
      setAnnouncement("Reduced motion is on. The complete provenance diagram remains visible.");
      return;
    }
    setRunId(previous => previous + 1);
    setPlaying(true);
    setAnnouncement("Replaying the evidence-to-brief signal sequence.");
  }, []);

  useEffect(() => {
    const media = getBrowserMediaQuery("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      const reduce = readMediaQueryMatches(media, true);
      setReducedMotion(reduce);
      if (reduce) setPlaying(false);
    };
    return subscribeToMediaQuery(media, handleChange);
  }, []);

  useEffect(() => {
    if (!playing) return;
    // A blocked first-entry storage write fails closed; manual replay does not
    // depend on storage permissions, and never clears a visitor's seen flag.
    if (runId === 0 && !markOpeningSeen(sessionStorageOrNull())) {
      setPlaying(false);
      return;
    }
    const settle = () => setPlaying(false);
    if (reducedMotionRequested()) {
      settle();
      return;
    }
    window.addEventListener("pointerdown", settle, { passive: true });
    window.addEventListener("keydown", settle);
    window.addEventListener("wheel", settle, { passive: true });
    window.addEventListener("touchstart", settle, { passive: true });
    window.addEventListener("pagehide", settle);
    document.addEventListener("visibilitychange", settleOnHidden);
    function settleOnHidden() {
      if (document.hidden) settle();
    }
    const timer = window.setTimeout(settle, OPENING_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", settle);
      window.removeEventListener("keydown", settle);
      window.removeEventListener("wheel", settle);
      window.removeEventListener("touchstart", settle);
      window.removeEventListener("pagehide", settle);
      document.removeEventListener("visibilitychange", settleOnHidden);
    };
  }, [playing, runId]);

  return { playing, replay, runId, reducedMotion, announcement };
}

type ConsoleStageId = "hidden-burden" | "local-terrain" | "intervention-levers" | "action-brief";

interface ConsoleStageMeta {
  id: ConsoleStageId;
  index: string;
  title: string;
  roleLabel: string;
  roleClass: "opening-lane lane-evidence" | "opening-lane lane-context" | "opening-lane lane-assumption" | "opening-lane lane-brief";
  subtitle: string;
}

const CONSOLE_STAGES: readonly ConsoleStageMeta[] = [
  {
    id: "hidden-burden",
    index: "01",
    title: "Hidden Burden",
    roleLabel: "Reviewed evidence",
    roleClass: "opening-lane lane-evidence",
    subtitle: "MEPS · estimate · uncertainty · source"
  },
  {
    id: "local-terrain",
    index: "02",
    title: "Local Terrain",
    roleLabel: "Local context",
    roleClass: "opening-lane lane-context",
    subtitle: "HRSA / ACS · selected record · provenance"
  },
  {
    id: "intervention-levers",
    index: "03",
    title: "Intervention Levers",
    roleLabel: "Analyst assumptions",
    roleClass: "opening-lane lane-assumption",
    subtitle: "reach · capacity · timing · resources"
  },
  {
    id: "action-brief",
    index: "04",
    title: "Action Brief",
    roleLabel: "Planning Brief",
    roleClass: "opening-lane lane-brief",
    subtitle: "boundaries preserved · gaps retained"
  }
];

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

interface OpeningProvenanceProps {
  playing: boolean;
  runId: number;
  reducedMotion: boolean;
  announcement: string;
  onReplay: () => void;
}

export function OpeningProvenance({ playing, runId, reducedMotion, announcement, onReplay }: OpeningProvenanceProps) {
  const {
    bundle,
    localContext,
    localContextStatus,
    selectedLocalContext,
    scenario,
    scenarioResult,
    availableDataRequests
  } = useArtifact();

  const [activeStage, setActiveStage] = useState<ConsoleStageId>("action-brief");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;

  const headlineRows = bundle ? selectHeadlineFindings(bundle).slice(0, 3) : [];
  const localRecords = localContextStatus === "loaded" && localContext
    ? localContext.indicators.filter(isSelectableLocalContextRecord).slice(0, 2)
    : [];
  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  const onStageKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % CONSOLE_STAGES.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (index + CONSOLE_STAGES.length - 1) % CONSOLE_STAGES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = CONSOLE_STAGES.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextStage = CONSOLE_STAGES[nextIndex]!;
    setActiveStage(nextStage.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <figure
      className={"overview-provenance" + (playing ? " is-playing" : "")}
      data-opening-state={playing ? "playing" : "complete"}
      data-active-stage={activeStage}
    >
      <div className="workspace-preview" data-replay-cycle={runId % 2}>
        <div className="preview-chrome">
          <span className="preview-brand-dot" aria-hidden="true" />
          <div className="preview-chrome-label">
            <strong>Executive strategy console</strong>
            <span>Evidence → terrain → levers → brief</span>
          </div>
          <button type="button" className="preview-replay" onClick={onReplay}>
            <span aria-hidden="true">↻</span> Replay animation
          </button>
        </div>
        {/* Only animated content remounts; the Replay control retains DOM identity and keyboard focus. */}
        <Fragment key={runId}>
          <div className="preview-progress" aria-hidden="true"><span /></div>
          <div className="preview-body">
            <div className="preview-lanes" role="group" aria-label="Evidence roles remain separate">
              <div className="console-tablist" role="tablist" aria-label="Strategy console stages" aria-orientation="vertical">
                {CONSOLE_STAGES.map((stage, index) => {
                  const selected = stage.id === activeStage;
                  return (
                    <button
                      key={stage.id}
                      ref={el => { tabRefs.current[index] = el; }}
                      id={`console-tab-${stage.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="console-inspector-panel"
                      tabIndex={selected ? 0 : -1}
                      className={`${stage.roleClass}${selected ? " is-selected" : ""}`}
                      onClick={() => setActiveStage(stage.id)}
                      onMouseEnter={() => setActiveStage(stage.id)}
                      onKeyDown={event => onStageKeyDown(event, index)}
                    >
                      <span className="lane-kicker">{stage.index} / {stage.roleLabel}</span>
                      <strong>{stage.title}</strong>
                      <span className="lane-rule" aria-hidden="true"><i /></span>
                      <small>{stage.subtitle}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="preview-routes" aria-hidden="true">
              <svg className="console-signal-svg" viewBox="0 0 40 320" preserveAspectRatio="none">
                <path className="signal-trace signal-evidence" pathLength={100} d="M0 44 C18 44, 22 160, 40 160" />
                <path className="signal-trace signal-context" pathLength={100} d="M0 122 C18 122, 22 160, 40 160" />
                <path className="signal-trace signal-assumption" pathLength={100} d="M0 200 C18 200, 22 160, 40 160" />
                <path className="signal-trace signal-brief" pathLength={100} d="M0 278 C18 278, 22 160, 40 160" />
                <circle className="signal-node signal-evidence" cx="36" cy="160" r="3" />
              </svg>
            </div>

            <div
              id="console-inspector-panel"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`console-tab-${activeStage}`}
              className="preview-output"
            >
              {activeStage === "hidden-burden" && (
                <>
                  <div className="preview-output-topline">
                    <span>01 / Reviewed evidence</span>
                    <i aria-hidden="true" />
                  </div>
                  <strong>Observed national burden across care, time &amp; distress.</strong>
                  <p className="preview-output-description">
                    Descriptive 2024 AHRQ MEPS estimates for U.S. adults with current Long COVID—gross spending is not attributable cost.
                  </p>
                  <dl className="console-live-metrics" aria-label="Live reviewed national estimates">
                    {headlineRows.length > 0 ? headlineRows.map(({ spec, estimate }) => (
                      <div key={spec.estimateId}>
                        <dt>{formatEstimateValue(estimate)}</dt>
                        <dd>
                          <span>{spec.label(estimate)}</span>
                          <small>{formatEstimateInterval(estimate)}</small>
                        </dd>
                      </div>
                    )) : (
                      <div>
                        <dt>{reviewedCount || "—"}</dt>
                        <dd><span>Reviewed national estimates loaded</span></dd>
                      </div>
                    )}
                  </dl>
                  <Link className="console-stage-link" to="/burden">Explore Cost &amp; Burden <span aria-hidden="true">→</span></Link>
                </>
              )}

              {activeStage === "local-terrain" && (
                <>
                  <div className="preview-output-topline">
                    <span>02 / Local context</span>
                    <i aria-hidden="true" />
                  </div>
                  <strong>West Virginia implementation &amp; access terrain.</strong>
                  <p className="preview-output-description">
                    HRSA shortage designations and Census ACS indicators describe local constraints—never local disease prevalence or cost.
                  </p>
                  <dl className="console-live-metrics" aria-label="Live local context records">
                    <div>
                      <dt>{localIndicatorCount ?? "—"}</dt>
                      <dd>
                        <span>Reviewed {localContext?.geography.geography_name ?? "state"} access &amp; shortage indicators</span>
                        <small>{selectedLocalContext.length} currently included in Action Brief</small>
                      </dd>
                    </div>
                    {localRecords.map(record => (
                      <div key={record.indicator_id}>
                        <dt>{formatLocalContextValue(record)}</dt>
                        <dd>
                          <span>{record.label}</span>
                          <small>{record.source_agency} · {record.source_release_vintage}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <Link className="console-stage-link" to="/local-context">Inspect Local Terrain <span aria-hidden="true">→</span></Link>
                </>
              )}

              {activeStage === "intervention-levers" && (
                <>
                  <div className="preview-output-topline">
                    <span>03 / Analyst assumptions</span>
                    <i aria-hidden="true" />
                  </div>
                  <strong>Transparent navigation-pilot arithmetic.</strong>
                  <p className="preview-output-description">
                    Deterministic reach, capacity, and resource figures from analyst inputs—not forecasts, savings, or ROI.
                  </p>
                  <dl className="console-live-metrics" aria-label="Live pilot assumption outputs">
                    <div>
                      <dt>{scenarioResult ? scenarioResult.reached_participants.toLocaleString("en-US") : "—"}</dt>
                      <dd>
                        <span>Reached participants ({scenario ? `${Math.round(scenario.reach * 100)}% reach` : "draft"})</span>
                        <small>Capacity gap: {scenarioResult ? scenarioResult.capacity_gap.toLocaleString("en-US") : "—"} · {scenario ? formatPathwayStepLabel(scenario.target_pathway_step) : "Navigation"}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>{scenarioResult ? usdFormat.format(scenarioResult.program_resource_requirement) : "—"}</dt>
                      <dd>
                        <span>Estimated program budget — not savings or ROI</span>
                        <small>{scenario ? `${scenario.horizon_months}-month horizon · fixed + variable resources` : "Deterministic budget"}</small>
                      </dd>
                    </div>
                  </dl>
                  <Link className="console-stage-link" to="/pilot">Open Strategy Lab <span aria-hidden="true">→</span></Link>
                </>
              )}

              {activeStage === "action-brief" && (
                <>
                  <div className="preview-output-topline">
                    <span>04 / Planning Brief</span>
                    <i aria-hidden="true" />
                  </div>
                  <strong>One traceable planning workflow.</strong>
                  <p className="preview-output-description">A documented decision state, not a combined scientific score.</p>
                  <div className="preview-boundary-line" aria-hidden="true" />
                  <dl className="console-live-summary-counts" aria-label="Current brief audit inventory">
                    <div>
                      <dt>{reviewedCount || "—"}</dt>
                      <dd>Reviewed estimates</dd>
                    </div>
                    <div>
                      <dt>{selectedLocalContext.length}</dt>
                      <dd>Selected local records</dd>
                    </div>
                    <div>
                      <dt>{availableDataRequests.length}</dt>
                      <dd>Tracked data gaps</dd>
                    </div>
                  </dl>
                  <ul>
                    <li><span /> Evidence boundaries preserved</li>
                    <li><span /> Assumptions explicitly labeled</li>
                    <li><span /> Unanswered data needs retained</li>
                  </ul>
                  <Link className="console-stage-link" to="/brief">Review Action Brief <span aria-hidden="true">→</span></Link>
                </>
              )}
            </div>
          </div>
          <div className="preview-footer">
            <span>THREE DISTINCT ROLES</span>
            <i aria-hidden="true">→</i>
            <span>ONE AUDITABLE ARTIFACT</span>
            <span className="preview-footer-state">{reducedMotion ? "Static view · reduced motion" : "Provenance intact"}</span>
          </div>
        </Fragment>
      </div>
      <figcaption>
        Interactive strategy console: select or hover any stage to inspect live Edition 01 figures. National estimates, local context, and analyst assumptions stay separate in the Planning Brief.
      </figcaption>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </figure>
  );
}
