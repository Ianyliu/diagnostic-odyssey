import { Fragment, useCallback, useEffect, useState } from "react";
import { canReplayOpening, markOpeningSeen, OPENING_DURATION_MS, reducedMotionRequested, sessionStorageOrNull, shouldPlayOpening } from "./openingMotion";
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
    setAnnouncement("Replaying the evidence-to-brief sequence.");
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

type SchematicStageId = "burden" | "terrain" | "levers" | "brief";

interface OpeningProvenanceProps {
  playing: boolean;
  runId: number;
  reducedMotion: boolean;
  announcement: string;
  onReplay: () => void;
  reviewedCount?: number;
  localIndicatorCount?: number | null;
  eligiblePopulation?: number;
  reachPercent?: number;
  capacity?: number;
  dataRequestCount?: number;
}

export function OpeningProvenance({
  playing,
  runId,
  reducedMotion,
  announcement,
  onReplay,
  reviewedCount = 21,
  localIndicatorCount = 34,
  eligiblePopulation = 12000,
  reachPercent = 25,
  capacity = 3000,
  dataRequestCount = 0
}: OpeningProvenanceProps) {
  const [selectedStage, setSelectedStage] = useState<SchematicStageId>("burden");

  const stages: ReadonlyArray<{
    id: SchematicStageId;
    code: string;
    label: string;
    fact: string;
    detail: string;
  }> = [
    {
      id: "burden",
      code: "01",
      label: "Hidden Burden",
      fact: `${reviewedCount || "—"} reviewed national estimates (MEPS)`,
      detail: "Descriptive all-cause spending, time, and screening distress carried by U.S. adults—kept separate from local prevalence and scenario inputs."
    },
    {
      id: "terrain",
      code: "02",
      label: "Local Terrain",
      fact: `${localIndicatorCount ?? "—"} reviewed access & shortage indicators`,
      detail: "HRSA shortage designations and Census ACS indicators describe local implementation conditions without estimating state disease prevalence."
    },
    {
      id: "levers",
      code: "03",
      label: "Intervention Levers",
      fact: `${eligiblePopulation.toLocaleString("en-US")} eligible · ${reachPercent}% reach · ${capacity.toLocaleString("en-US")} capacity`,
      detail: "Explicit analyst planning assumptions bound to a named pathway step and mechanism—never treated as observed effects or savings."
    },
    {
      id: "brief",
      code: "04",
      label: "Action Brief",
      fact: `${dataRequestCount} active data request${dataRequestCount === 1 ? "" : "s"} · auditable export`,
      detail: "Documented decision state carrying each layer's provenance, interpretation boundaries, and open data gaps without blending quantities."
    }
  ];

  const activeStage = stages.find(stage => stage.id === selectedStage) ?? stages[0]!;

  return <figure className={"overview-provenance" + (playing ? " is-playing" : "")} data-opening-state={playing ? "playing" : "complete"}>
    <div className="workspace-preview" data-replay-cycle={runId % 2}>
      <div className="preview-chrome">
        <span className="preview-brand-dot" aria-hidden="true" />
        <div className="preview-chrome-label">
          <strong>Schematic provenance console</strong>
          <span>Evidence → documented decision</span>
        </div>
        <button type="button" className="preview-replay" onClick={onReplay}>
          <span aria-hidden="true">↻</span> Replay animation
        </button>
      </div>
      {/* Only animated content remounts; the Replay control retains DOM identity and keyboard focus. */}
      <Fragment key={runId}>
      <div className="preview-progress" aria-hidden="true"><span /></div>
      <div className="schematic-node-bar" role="group" aria-label="Interactive schematic stage inspector">
        {stages.map(stage => (
          <button
            key={stage.id}
            type="button"
            className="schematic-node-tab"
            aria-pressed={selectedStage === stage.id}
            onClick={() => setSelectedStage(stage.id)}
          >
            <span className="schematic-node-code">{stage.code}</span>
            <strong>{stage.label}</strong>
          </button>
        ))}
      </div>
      <div className="preview-body">
        <div className="preview-lanes" role="group" aria-label="Evidence roles remain separate">
          <div
            className={`opening-lane lane-evidence${selectedStage === "burden" ? " is-active" : ""}`}
            onClick={() => setSelectedStage("burden")}
          >
            <span className="lane-kicker">01 / Reviewed evidence</span>
            <strong>National burden</strong>
            <span className="lane-rule"><i /></span>
            <small>MEPS · estimate · uncertainty · source</small>
          </div>
          <div
            className={`opening-lane lane-context${selectedStage === "terrain" ? " is-active" : ""}`}
            onClick={() => setSelectedStage("terrain")}
          >
            <span className="lane-kicker">02 / Local context</span>
            <strong>Implementation conditions</strong>
            <span className="lane-rule"><i /></span>
            <small>HRSA / ACS · selected record · provenance</small>
          </div>
          <div
            className={`opening-lane lane-assumption${selectedStage === "levers" ? " is-active" : ""}`}
            onClick={() => setSelectedStage("levers")}
          >
            <span className="lane-kicker">03 / Analyst assumptions</span>
            <strong>Pilot scenario</strong>
            <span className="lane-rule"><i /></span>
            <small>reach · capacity · timing · resources</small>
          </div>
        </div>
        <div className="preview-routes" aria-hidden="true">
          <svg className="preview-schematic-svg" viewBox="0 0 44 260" preserveAspectRatio="none">
            <path className="trace-path trace-evidence" d="M 0 45 C 22 45, 22 72, 42 72" />
            <circle className="trace-node trace-node-evidence" cx="40" cy="72" r="3" />
            <path className="trace-path trace-context" d="M 0 130 L 42 130" />
            <circle className="trace-node trace-node-context" cx="40" cy="130" r="3" />
            <path className="trace-path trace-assumption" d="M 0 215 C 22 215, 22 188, 42 188" />
            <circle className="trace-node trace-node-assumption" cx="40" cy="188" r="3" />
          </svg>
        </div>
        <div
          className={`preview-output${selectedStage === "brief" ? " is-active" : ""}`}
          onClick={() => setSelectedStage("brief")}
        >
          <div className="preview-output-topline">
            <span>04 / Planning Brief</span>
            <i aria-hidden="true" />
          </div>
          <strong>One traceable planning workflow.</strong>
          <p className="preview-output-description">A documented decision state, not a combined scientific score.</p>
          <div className="preview-boundary-line" aria-hidden="true" />
          <ul>
            <li><span /> Evidence boundaries preserved</li>
            <li><span /> Assumptions explicitly labeled</li>
            <li><span /> Unanswered data needs retained</li>
          </ul>
        </div>
      </div>
      <div className="preview-inspector" role="region" aria-live="polite" aria-label="Selected schematic stage details">
        <div className="preview-inspector-head">
          <span className="preview-inspector-kicker">{activeStage.code} · {activeStage.label}</span>
          <span className="preview-inspector-fact">{activeStage.fact}</span>
        </div>
        <p>{activeStage.detail}</p>
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
      Conceptual workflow, not a quantitative model. National estimates, local context, and analyst assumptions stay separate in the Planning Brief.
    </figcaption>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </figure>;
}
