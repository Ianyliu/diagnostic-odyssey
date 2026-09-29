import { useEffect, useState } from "react";
import { markOpeningSeen, shouldPlayOpening } from "./openingMotion";

const documentEntry = {
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash
};

function sessionStorageOrNull(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

function reducedMotionRequested(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return true; }
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
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) settle();
    media.addEventListener("change", settle);
    window.addEventListener("pointerdown", settle, { passive: true });
    window.addEventListener("keydown", settle);
    window.addEventListener("wheel", settle, { passive: true });
    window.addEventListener("touchstart", settle, { passive: true });
    const timer = window.setTimeout(settle, 1200);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", settle);
      window.removeEventListener("pointerdown", settle);
      window.removeEventListener("keydown", settle);
      window.removeEventListener("wheel", settle);
      window.removeEventListener("touchstart", settle);
    };
  }, [playing]);

  return <figure className={"overview-provenance" + (playing ? " is-playing" : "")}>
    <svg viewBox="0 0 520 292" aria-hidden="true" focusable="false">
      <rect className="opening-paper" x="1" y="1" width="518" height="290" rx="5" />
      <path className="opening-rule" d="M22 33 H498 M22 259 H498" />
      <text className="opening-topline" x="25" y="24">DIAGNOSTIC ODYSSEY  /  WORKSPACE MAP</text>

      <g className="opening-fragment opening-evidence">
        <rect x="30" y="52" width="145" height="54" rx="3" />
        <path d="M44 72 H111 M44 82 H149 M44 92 H133" />
        <text x="30" y="48">EVIDENCE</text>
      </g>
      <g className="opening-fragment opening-context">
        <rect x="30" y="119" width="145" height="54" rx="3" />
        <path d="M44 137 H84 M44 147 H150 M44 157 H119" />
        <text x="30" y="115">LOCAL CONTEXT</text>
      </g>
      <g className="opening-fragment opening-assumptions">
        <rect x="30" y="186" width="145" height="54" rx="3" />
        <path d="M44 204 H150 M44 214 H91 M44 224 H135" />
        <text x="30" y="182">ASSUMPTIONS</text>
      </g>

      <path className="opening-connector" d="M175 79 H225 Q237 79 237 91 V144 H271" />
      <path className="opening-connector" d="M175 146 H271" />
      <path className="opening-connector" d="M175 213 H225 Q237 213 237 201 V148 H271" />
      <circle className="opening-junction" cx="274" cy="146" r="4" />

      <g className="opening-identity">
        <path d="M300 76 H477 V216 H300" />
        <text className="opening-identity-kicker" x="319" y="113">TRACEABLE PLANNING</text>
        <image href="/diagnostic-odyssey-icon.png" x="340" y="115" width="96" height="96" />
      </g>
      <text className="opening-footline" x="25" y="278">CONCEPTUAL LAYERS  ·  NO DATA VALUES SHOWN</text>
    </svg>
    <figcaption>Evidence, local context, and analyst assumptions remain distinct as the planning workspace is composed. This diagram contains no data values.</figcaption>
  </figure>;
}
