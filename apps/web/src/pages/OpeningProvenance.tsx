import { useCallback, useEffect, useState } from "react";
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

interface OpeningProvenanceProps {
  playing: boolean;
  runId: number;
  reducedMotion: boolean;
  announcement: string;
  onReplay: () => void;
}

export function OpeningProvenance({ playing, runId, reducedMotion, announcement, onReplay }: OpeningProvenanceProps) {
  return <figure className={"overview-provenance" + (playing ? " is-playing" : "")} data-opening-state={playing ? "playing" : "complete"}>
    <div className="workspace-preview" key={runId}>
      <div className="preview-chrome">
        <span className="preview-brand-dot" aria-hidden="true" />
        <div className="preview-chrome-label">
          <strong>Provenance circuit</strong>
          <span>Evidence → documented decision</span>
        </div>
        <button type="button" className="preview-replay" onClick={onReplay}>
          <span aria-hidden="true">↻</span> Replay animation
        </button>
      </div>
      <div className="preview-progress" aria-hidden="true"><span /></div>
      <div className="preview-body">
        <div className="preview-lanes" role="group" aria-label="Evidence roles remain separate">
          <div className="opening-lane lane-evidence">
            <span className="lane-kicker">01 / Reviewed evidence</span>
            <strong>National burden</strong>
            <span className="lane-rule"><i /></span>
            <small>MEPS · estimate · uncertainty · source</small>
          </div>
          <div className="opening-lane lane-context">
            <span className="lane-kicker">02 / Local context</span>
            <strong>Implementation conditions</strong>
            <span className="lane-rule"><i /></span>
            <small>HRSA / ACS · selected record · provenance</small>
          </div>
          <div className="opening-lane lane-assumption">
            <span className="lane-kicker">03 / Analyst assumptions</span>
            <strong>Pilot scenario</strong>
            <span className="lane-rule"><i /></span>
            <small>reach · capacity · timing · resources</small>
          </div>
        </div>
        <div className="preview-routes" aria-hidden="true">
          <span className="route-evidence" />
          <span className="route-context" />
          <span className="route-assumption" />
        </div>
        <div className="preview-output">
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
      <div className="preview-footer">
        <span>THREE DISTINCT ROLES</span>
        <i aria-hidden="true">→</i>
        <span>ONE AUDITABLE ARTIFACT</span>
        <span className="preview-footer-state">{reducedMotion ? "Static view · reduced motion" : "Provenance intact"}</span>
      </div>
    </div>
    <figcaption>
      Conceptual workflow, not a quantitative model. National estimates, local context, and analyst assumptions stay separate in the Planning Brief.
    </figcaption>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </figure>;
}
