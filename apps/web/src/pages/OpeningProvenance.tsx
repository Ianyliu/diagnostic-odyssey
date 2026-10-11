import { useEffect, useState } from "react";
import { markOpeningSeen, shouldPlayOpening } from "./openingMotion";
import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery } from "../browserMedia";

const documentEntry = typeof window !== "undefined" ? {
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash
} : { pathname: "/", search: "", hash: "" };

function sessionStorageOrNull(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
function reducedMotionRequested(): boolean {
  return readMediaQueryMatches(getBrowserMediaQuery("(prefers-reduced-motion: reduce)"), true);
}

export function OpeningProvenance() {
  const [playing, setPlaying] = useState(() => shouldPlayOpening({
    ...documentEntry,
    reducedMotion: reducedMotionRequested(),
    storage: sessionStorageOrNull()
  }));

  useEffect(() => {
    if (!playing) return;
    if (!markOpeningSeen(sessionStorageOrNull())) {
      setPlaying(false);
      return;
    }
    const settle = () => setPlaying(false);
    const media = getBrowserMediaQuery("(prefers-reduced-motion: reduce)");
    if (readMediaQueryMatches(media, true)) {
      settle();
      return;
    }
    const unsubscribeMedia = subscribeToMediaQuery(media, settle);
    window.addEventListener("pointerdown", settle, { passive: true });
    window.addEventListener("keydown", settle);
    window.addEventListener("wheel", settle, { passive: true });
    window.addEventListener("touchstart", settle, { passive: true });
    const timer = window.setTimeout(settle, 1450);
    return () => {
      window.clearTimeout(timer);
      unsubscribeMedia();
      window.removeEventListener("pointerdown", settle);
      window.removeEventListener("keydown", settle);
      window.removeEventListener("wheel", settle);
      window.removeEventListener("touchstart", settle);
    };
  }, [playing]);

  return <figure className={"overview-provenance" + (playing ? " is-playing" : "")}>
    <div className="workspace-preview">
      <div className="preview-chrome">
        <span className="preview-brand-dot" />
        <strong>Decision workspace</strong>
        <span className="preview-status">Reviewed + traceable</span>
      </div>
      <div className="preview-body">
        <div className="preview-lanes" role="group" aria-label="Evidence roles remain separate">
          <div className="opening-lane lane-evidence">
            <span className="lane-kicker">Reviewed evidence</span>
            <strong>National burden</strong>
            <span className="lane-rule"><i /></span>
            <small>survey estimate · CI · source</small>
          </div>
          <div className="opening-lane lane-context">
            <span className="lane-kicker">Local context</span>
            <strong>Implementation constraints</strong>
            <span className="lane-rule"><i /></span>
            <small>selected record · provenance</small>
          </div>
          <div className="opening-lane lane-assumption">
            <span className="lane-kicker">Analyst assumptions</span>
            <strong>Pilot scenario</strong>
            <span className="lane-rule"><i /></span>
            <small>reach · capacity · timing</small>
          </div>
        </div>
        <div className="preview-output">
          <div className="preview-output-topline">
            <span>Planning brief</span>
            <i />
          </div>
          <strong>Traceable decision state</strong>
          <div className="preview-boundary-line" aria-hidden="true" />
          <ul>
            <li><span /> Evidence boundary retained</li>
            <li><span /> Assumptions labeled</li>
            <li><span /> Data gaps visible</li>
          </ul>
        </div>
      </div>
      <div className="preview-footer">
        <span>Distinct inputs</span>
        <i aria-hidden="true">→</i>
        <span>one auditable planning artifact</span>
      </div>
    </div>
    <figcaption>
      Conceptual workspace preview. The three lanes stay distinct all the way into the Planning brief; no data values are combined into a composite score.
    </figcaption>
  </figure>;
}
