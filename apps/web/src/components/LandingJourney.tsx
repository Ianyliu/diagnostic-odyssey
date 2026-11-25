import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  canReplayOpening,
  JOURNEY_DURATION_MS,
  JOURNEY_SESSION_KEY,
  markOpeningSeen,
  reducedMotionRequested,
  sessionStorageOrNull,
  shouldPlayJourney
} from "../pages/openingMotion";
import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery } from "../browserMedia";
import "./LandingJourney.css";

/**
 * Restored sweeping Bezier cartographic pathway (1024x380 viewBox) inside Chapter IV.
 * Primary spine moves 01 Burden -> 02 Local context -> 03 Strategy Lab -> 04 Planning Brief,
 * with Data requests shown as an explicit dashed optional spur off Strategy Lab.
 * Has its own independent viewport-triggered lifecycle so Chapter I completion or scroll
 * inertia never consumes or cancels the Chapter IV reveal.
 */
const waypoints = [
  { label: "Burden", n: "01", to: "/burden", action: "Explore the burden", x: 96, y: 296, type: "evidence" },
  { label: "Local context", n: "02", to: "/local-context", action: "Check local access", x: 340, y: 178, type: "context" },
  { label: "Strategy Lab", n: "03", to: "/pilot", action: "Test a pilot scenario", x: 602, y: 232, type: "assumption" },
  { label: "Data requests", n: "Optional", to: "/data-requests", action: "Identify what’s missing", x: 758, y: 316, type: "gap" },
  { label: "Planning Brief", n: "04", to: "/brief", action: "Prepare a decision brief", x: 916, y: 88, type: "brief" }
] as const;

const route =
  "M 96 296 C 216 296, 224 178, 340 178 C 464 178, 486 232, 602 232 C 742 232, 782 88, 916 88";
const optionalSpur = "M 602 232 C 646 298, 696 316, 758 316";

export function LandingJourney() {
  const navRef = useRef<HTMLElement>(null);
  const hasAutoPlayedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);
  const [runId, setRunId] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const media = getBrowserMediaQuery("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      if (readMediaQueryMatches(media, true)) setPlaying(false);
    };
    return subscribeToMediaQuery(media, handleChange);
  }, []);

  // Independent viewport-triggered reveal for Chapter IV.
  useEffect(() => {
    const root = navRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const triggerIfEligible = () => {
      if (hasAutoPlayedRef.current) return;
      const entry = typeof window !== "undefined"
        ? {
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            reducedMotion: reducedMotionRequested(),
            storage: sessionStorageOrNull()
          }
        : { pathname: "/", search: "", hash: "", reducedMotion: true, storage: null };

      if (!shouldPlayJourney(entry)) {
        try {
          if (!entry.search && !entry.hash && !entry.reducedMotion && entry.storage?.getItem(JOURNEY_SESSION_KEY) === "seen") {
            setScrollReady(true);
          }
        } catch {
          // A blocked session uses the static pathway and manual motion control.
        }
        return;
      }
      if (!markOpeningSeen(sessionStorageOrNull(), JOURNEY_SESSION_KEY)) return;
      hasAutoPlayedRef.current = true;
      setRunId(previous => previous + 1);
      setPlaying(true);
    };

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            triggerIfEligible();
          }
        }
      },
      { threshold: [0, 0.25, 0.5] }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Interruptible by deliberate pointerdown/keydown/visibility; never canceled by wheel scroll inertia.
  useEffect(() => {
    if (!playing) return;
    if (reducedMotionRequested()) {
      setPlaying(false);
      return;
    }

    const settle = () => setPlaying(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".preview-replay")) return;
      settle();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "Enter" || event.key === " ") &&
        event.target instanceof Element &&
        event.target.closest(".preview-replay")
      ) {
        return;
      }
      settle();
    };
    const settleOnHidden = () => {
      if (document.hidden) settle();
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pagehide", settle);
    document.addEventListener("visibilitychange", settleOnHidden);
    const timer = window.setTimeout(() => {
      settle();
      if (sessionStorageOrNull() && !window.location.search && !window.location.hash) setScrollReady(true);
    }, JOURNEY_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pagehide", settle);
      document.removeEventListener("visibilitychange", settleOnHidden);
    };
  }, [playing, runId]);

  const replay = useCallback(() => {
    const prefersReduced = reducedMotionRequested();
    if (!canReplayOpening(prefersReduced)) {
      setPlaying(false);
      setAnnouncement("Reduced motion is on. The complete pathway remains visible.");
      return;
    }
    hasAutoPlayedRef.current = true;
    setRunId(previous => previous + 1);
    setPlaying(true);
    setAnnouncement("Replaying the burden-to-brief pathway sequence.");
  }, []);

  return (
    <nav
      ref={navRef}
      className={`atlas-journey${playing ? " is-playing" : ""}${scrollReady ? " is-scroll-ready" : ""}`}
      aria-label="Explore the evidence-to-action pathway"
    >
      <div className="atlas-journey-canvas" data-replay-cycle={runId % 2}>
          <svg key={runId} viewBox="0 0 1024 380" className="atlas-journey-path" aria-hidden="true">
            <defs>
              <pattern id="atlas-journey-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="#251d40" />
                <path d="M0 0V8" stroke="#b8a5ff" strokeWidth="2.5" />
              </pattern>
            </defs>
            <path d={route} fill="none" stroke="#556b92" strokeWidth="1.5" strokeDasharray="3 8" />
            <path
              d={route}
              pathLength={1}
              className="atlas-journey-reveal"
              fill="none"
              stroke="#b8a5ff"
              strokeOpacity="0.95"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={optionalSpur}
              pathLength={1}
              className="atlas-journey-spur"
              fill="none"
              stroke="#9fb3d1"
              strokeOpacity="0.82"
              strokeWidth="2.2"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <g className="atlas-journey-scroll-accent">
              <path d={route} pathLength={1} className="atlas-journey-scroll-trace" fill="none"
                stroke="#f5f0ff" strokeWidth="4.5" strokeLinecap="round" />
            </g>
            <circle cx={916} cy={88} r={14} className="atlas-journey-halo" />
            {waypoints.map((item, idx) => (
              <circle
                key={item.to}
                className={`atlas-journey-point atlas-journey-point-${idx} is-${item.type}`}
                cx={item.x}
                cy={item.y}
                r={item.type === "brief" ? 14 : item.type === "gap" ? 9 : 11}
                fill={item.type === "assumption" ? "url(#atlas-journey-hatch)" : undefined}
                strokeWidth="2.6"
              />
            ))}
          </svg>
        <ol className="atlas-journey-mobile">
          {waypoints.map((item, index) => (
            <li key={item.to} className={`is-${item.type}`}>
              <Link
                to={item.to}
                className={`atlas-journey-stop atlas-journey-stop-${index}${item.type === "gap" ? " is-optional-spur" : ""}`}
              >
                <span className="atlas-journey-stop-label">{item.action}</span>
                <span className="atlas-journey-stop-number">{item.n} · {item.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <div className="atlas-journey-controls">
        <button type="button" className="preview-replay atlas-journey-replay" aria-label="Replay animation" onClick={replay}>
          <span aria-hidden="true">↻</span> Replay animation
        </button>
        <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      </div>

      <ul className="atlas-journey-key" aria-label="Evidence role symbol key">
        <li className="is-evidence"><i aria-hidden="true" />Reviewed evidence</li>
        <li className="is-context"><i aria-hidden="true" />Local access</li>
        <li className="is-assumption"><i aria-hidden="true" />Pilot assumptions</li>
        <li className="is-gap"><i aria-hidden="true" />Optional data requests</li>
      </ul>
    </nav>
  );
}
