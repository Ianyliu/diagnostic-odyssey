import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useArtifact } from "../data/ArtifactContext";
import { ThemeControl } from "./ThemeControl";

const nav = [
  ["/", "Overview"],
  ["/burden", "Burden"],
  ["/local-context", "Local Context"],
  ["/pilot", "Pilot Planner"],
  ["/evidence", "Evidence"],
  ["/data-requests", "Data Requests"],
  ["/brief", "Planning Brief"]
] as const;

const savedScroll = new Map<string, number>();

function focusTarget(target: HTMLElement) {
  const focusElement = target.matches("h1, h2, h3")
    ? target
    : target.querySelector<HTMLElement>("h1, h2, h3") ?? target;
  if (!focusElement.hasAttribute("tabindex")) focusElement.tabIndex = -1;
  focusElement.focus({ preventScroll: true });
}

function scrollToFragment(hash: string): boolean {
  if (!hash) return false;
  let id = hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* Use literal fragment. */ }
  const target = document.getElementById(id);
  if (!target) return false;
  focusTarget(target);
  target.scrollIntoView({ block: "start" });
  return true;
}

export function AppShell() {
  const {bundle, localContextStatus} = useArtifact();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [menuOpen, setMenuOpen] = useState(false);
  const initialRoute = useRef(true);
  const menuToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuToggle.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (navigationType === "POP" && savedScroll.has(location.key)) {
        window.scrollTo(0, savedScroll.get(location.key) ?? 0);
      } else if (scrollToFragment(location.hash)) {
        // Anchor focus and scrolling were handled together.
      } else if (!initialRoute.current) {
        const main = document.getElementById("main-content");
        if (main) focusTarget(main);
        window.scrollTo(0, 0);
      }
      initialRoute.current = false;
    });
    return () => {
      cancelAnimationFrame(frame);
      savedScroll.set(location.key, window.scrollY);
    };
  }, [location.key, location.hash, navigationType]);

  const localContextMessage =
    localContextStatus === "loading"
      ? "Local implementation context · loading"
      : localContextStatus === "loaded"
        ? "West Virginia implementation context · reviewed state data"
        : "Local implementation context · unavailable";
  const approvedEvidenceCount = bundle?.evidence.filter(record => record.reviewer_status === "approved").length ?? 0;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Diagnostic Odyssey, Overview">
            <strong>Diagnostic Odyssey</strong>
            <span>PUBLIC HEALTH EVIDENCE WORKSPACE</span>
          </Link>
          <button
            ref={menuToggle}
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >{menuOpen ? "Close menu" : "Menu"}</button>
          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className={"primary-nav" + (menuOpen ? " open" : "")}
          >
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({isActive}) => isActive ? "active" : undefined}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className={"header-controls" + (menuOpen ? " open" : "")}>
            <ThemeControl />
          </div>
        </div>
      </header>
      <div className="prototype-strip" role="note">
        <strong>National MEPS burden · reviewed</strong>
        <span>{localContextMessage}</span>
        <span>Pilot · analyst assumptions</span>
        <span>{approvedEvidenceCount === 0
          ? "Intervention effect · no approved record loaded"
          : `Intervention evidence · ${approvedEvidenceCount} approved record${approvedEvidenceCount === 1 ? "" : "s"}; check scenario eligibility`}</span>
      </div>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span>Diagnostic Odyssey</span>
        <span>No PHI · no state-specific Long COVID cost · no causal ROI claim</span>
      </footer>
    </div>
  );
}
