import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
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
      setAnnouncement("Reduced motion is on. The four-layer strategy dossier remains visible.");
      return;
    }
    setRunId(previous => previous + 1);
    setPlaying(true);
    setAnnouncement("Replaying the four-layer strategy dossier introduction.");
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

interface DossierLayer {
  readonly id: string;
  readonly index: string;
  readonly shortTitle: string;
  readonly roleTone: "reviewed" | "context" | "assumption" | "brief";
  readonly roleLabel: string;
  readonly heading: string;
  readonly sourceTag: string;
  readonly summary: string;
  readonly boundaryRule: string;
  readonly actionTo: string;
  readonly actionLabel: string;
}

const DOSSIER_LAYERS: readonly DossierLayer[] = [
  {
    id: "burden",
    index: "01",
    shortTitle: "Burden",
    roleTone: "reviewed",
    roleLabel: "Reviewed evidence",
    heading: "National descriptive burden",
    sourceTag: "AHRQ MEPS 2024 · 95% CI · Source provenance",
    summary: "All-cause medical spending, visit and administrative time, and screening distress carried by adults—reported in separate native units.",
    boundaryRule: "Observed all-cause burden only; never relabeled as illness-attributable cost or pooled into an opaque score.",
    actionTo: "/burden",
    actionLabel: "Inspect Cost & Burden"
  },
  {
    id: "terrain",
    index: "02",
    shortTitle: "Terrain",
    roleTone: "context",
    roleLabel: "Local context",
    heading: "Implementation conditions",
    sourceTag: "HRSA HPSA & Census ACS · State & county indicators",
    summary: "Provider shortage designations, rural composition, uninsured rates, and transit constraints shaping how navigation programs operate.",
    boundaryRule: "Describes local delivery terrain only; never implies local disease prevalence or modifies national burden.",
    actionTo: "/local-context",
    actionLabel: "Inspect Local Terrain"
  },
  {
    id: "strategy",
    index: "03",
    shortTitle: "Strategy",
    roleTone: "assumption",
    roleLabel: "Analyst assumptions",
    heading: "Pilot scenario arithmetic",
    sourceTag: "Explicit inputs · Reach, capacity, timing, budget",
    summary: "Transparent deterministic arithmetic testing intended reach against staffing capacity, exposure windows, and fixed/variable program cost.",
    boundaryRule: "Planning assumptions only; outputs are mechanical consequences, never forecasts, savings, or causal ROI.",
    actionTo: "/pilot",
    actionLabel: "Open Strategy Lab"
  },
  {
    id: "brief",
    index: "04",
    shortTitle: "Brief",
    roleTone: "brief",
    roleLabel: "Planning Brief",
    heading: "One traceable planning workflow",
    sourceTag: "Auditable export · Boundaries & gaps intact",
    summary: "Carries reviewed national evidence, selected local terrain, explicit scenario assumptions, and unanswered data requests into a single executive record.",
    boundaryRule: "A documented decision state, not a combined scientific score.",
    actionTo: "/brief",
    actionLabel: "Review Action Brief"
  }
];

interface OpeningProvenanceProps {
  playing: boolean;
  runId: number;
  reducedMotion: boolean;
  announcement: string;
  onReplay: () => void;
}

export function OpeningProvenance({ playing, runId, reducedMotion, announcement, onReplay }: OpeningProvenanceProps) {
  const [activeLayerId, setActiveLayerId] = useState<string>(DOSSIER_LAYERS[0]!.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeLayer = DOSSIER_LAYERS.find(layer => layer.id === activeLayerId) ?? DOSSIER_LAYERS[0]!;

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % DOSSIER_LAYERS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index + DOSSIER_LAYERS.length - 1) % DOSSIER_LAYERS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = DOSSIER_LAYERS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextLayer = DOSSIER_LAYERS[nextIndex]!;
    setActiveLayerId(nextLayer.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <figure className={"overview-provenance" + (playing ? " is-playing" : "")} data-opening-state={playing ? "playing" : "complete"}>
      <div className="strategy-dossier" data-replay-cycle={runId % 2}>
        <div className="dossier-chrome">
          <div className="dossier-chrome-label">
            <span className="dossier-kicker">STRATEGY DOSSIER · 04 LAYERS</span>
            <strong>Evidence to documented brief</strong>
          </div>
          <button type="button" className="dossier-replay" onClick={onReplay}>
            <span aria-hidden="true">↻</span> Replay sequence
          </button>
        </div>

        {/* Only animated dossier body remounts; Replay retains DOM identity and keyboard focus. */}
        <Fragment key={runId}>
          <div className="dossier-tabs" role="tablist" aria-label="Evidence roles remain separate">
            {DOSSIER_LAYERS.map((layer, index) => {
              const selected = layer.id === activeLayer.id;
              return (
                <button
                  key={layer.id}
                  ref={el => { tabRefs.current[index] = el; }}
                  id={`dossier-tab-${layer.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="dossier-tabpanel"
                  tabIndex={selected ? 0 : -1}
                  className={`dossier-tab dossier-tab-${layer.roleTone}`}
                  onClick={() => setActiveLayerId(layer.id)}
                  onKeyDown={event => onTabKeyDown(event, index)}
                >
                  <span className="dossier-tab-index">{layer.index}</span>
                  <span className="dossier-tab-title">{layer.shortTitle}</span>
                </button>
              );
            })}
          </div>

          <div
            id="dossier-tabpanel"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`dossier-tab-${activeLayer.id}`}
            className={`dossier-panel dossier-panel-${activeLayer.roleTone}`}
          >
            <div className="dossier-panel-meta">
              <span className={`dossier-role-tag tag-${activeLayer.roleTone}`}>
                {activeLayer.index} / {activeLayer.roleLabel}
              </span>
              <span className="dossier-source-tag">{activeLayer.sourceTag}</span>
            </div>
            <h2 className="dossier-panel-heading">{activeLayer.heading}</h2>
            <p className="dossier-panel-summary">{activeLayer.summary}</p>
            <div className="dossier-boundary-box" role="note">
              <span className="dossier-boundary-label">Boundary rule</span>
              <p>{activeLayer.boundaryRule}</p>
            </div>
            <div className="dossier-panel-footer">
              <div className="dossier-layer-rail" aria-hidden="true">
                {DOSSIER_LAYERS.map(layer => (
                  <span
                    key={layer.id}
                    className={`dossier-rail-segment${layer.id === activeLayer.id ? " is-active" : ""}`}
                  />
                ))}
              </div>
              <Link className="dossier-panel-link" to={activeLayer.actionTo}>
                {activeLayer.actionLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="dossier-footer">
            <span>THREE DISTINCT ROLES</span>
            <i aria-hidden="true">→</i>
            <span>ONE AUDITABLE ARTIFACT</span>
            <span className="dossier-footer-state">
              {reducedMotion ? "Static view · reduced motion" : "Boundaries intact"}
            </span>
          </div>
        </Fragment>
      </div>
      <figcaption>
        Conceptual workflow, not a quantitative model. National estimates, local context, and analyst assumptions stay separate in the Planning Brief.
      </figcaption>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </figure>
  );
}
