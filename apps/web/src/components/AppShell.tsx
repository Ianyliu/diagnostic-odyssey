import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { workspaceStageForPath } from "../data/workspaceNavigation";
import { DisclosureProvider } from "./WorkspaceDisclosure";
import "./WorkspaceNavigation.css";
import { focusTarget, scrollToFragment } from "../data/fragmentNavigation";
import { ThemeControl } from "./ThemeControl";
import { EditionModal } from "./EditionModal";
import { displayBuildProvenance, type BuildProvenance } from "../data/buildProvenance";

/** Replaced with a validated Git checkout identity by Vite at build time. */
declare const __DO_BUILD_PROVENANCE__: BuildProvenance;

const savedScroll = new Map<string, number>();
const aiStudioAvailable = import.meta.env.VITE_FUTURE_AI_EXPERIENCE_DEMO !== "off";

const railItems: ReadonlyArray<{
  to: string;
  code: string;
  label: string;
  matchStage?: string;
}> = [
  { to: "/", code: "00", label: "Overview" },
  { to: "/burden", code: "01", label: "Costs", matchStage: "/burden" },
  { to: "/local-context", code: "02", label: "Terrain", matchStage: "/local-context" },
  { to: "/pilot", code: "03", label: "Simulate", matchStage: "/pilot" },
  { to: "/brief", code: "04", label: "Brief", matchStage: "/brief" }
];

export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editionOpen, setEditionOpen] = useState(false);
  const initialRoute = useRef(true);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const preFragmentScroll = useRef<number | null>(null);
  const lastScrollY = useRef(0);

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
    const onHashChange = () => {
      if (window.location.pathname === location.pathname) {
        if (window.location.hash) {
          scrollToFragment(window.location.hash);
        } else if (preFragmentScroll.current !== null) {
          window.scrollTo(0, preFragmentScroll.current);
        }
      }
    };
    const onFragmentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || !link.hash) return;
      const hash = link.hash;
      if (!window.location.hash) preFragmentScroll.current = window.scrollY;
      if (window.location.hash === hash) requestAnimationFrame(() => scrollToFragment(hash));
    };
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onFragmentClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onFragmentClick);
    };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const recordScroll = () => { lastScrollY.current = window.scrollY; };
    recordScroll();
    window.addEventListener("scroll", recordScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", recordScroll);
      savedScroll.set(location.key, lastScrollY.current);
    };
  }, [location.key]);

  useEffect(() => {
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (navigationType === "POP" && savedScroll.has(location.key)) {
        scrollToFragment(location.hash);
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
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, navigationType]);

  const activeStage = workspaceStageForPath(location.pathname);
  const advisorActive = location.pathname === "/advisor" || location.pathname === "/concept/future-ai";
  const buildIdentity = displayBuildProvenance(__DO_BUILD_PROVENANCE__);

  const isRouteActive = (item: (typeof railItems)[number]) => {
    if (advisorActive) return false;
    if (item.to === "/") return location.pathname === "/";
    return activeStage === item.matchStage;
  };

  return (
    <div className="app-shell command-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="command-rail" aria-label="Command navigation">
        <div className="rail-top-bar">
          <Link className="brand" to="/" aria-label="Diagnostic Odyssey, Overview">
            <img
              className="brand-crest"
              src="/diagnostic-odyssey-mark.svg"
              width="32"
              height="32"
              alt=""
            />
            <span className="brand-copy">
              <strong>Diagnostic Odyssey</strong>
              <span>COMMAND WORKSPACE</span>
            </span>
          </Link>
          <button
            ref={menuToggle}
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="workspace-tools"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>

        <div id="workspace-tools" className={`rail-drawer${menuOpen ? " open" : ""}`}>
          <nav id="primary-navigation" className="rail-nav" aria-label="Primary navigation">
            {railItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={() => `rail-link${isRouteActive(item) ? " active" : ""}`}
              >
                {item.to !== "/" && <span className="rail-code" aria-hidden="true">{item.code}</span>}
                <span className="rail-label">{item.label}</span>
              </NavLink>
            ))}
            {aiStudioAvailable && (
              <NavLink
                to="/advisor"
                className={() => `rail-link rail-link-advisor${advisorActive ? " active" : ""}`}
              >
                <span className="rail-dot" aria-hidden="true" />
                <span className="rail-label">AI Strategist</span>
              </NavLink>
            )}
          </nav>

          <div className="rail-secondary" aria-label="Supporting routes">
            <Link
              to="/evidence"
              className={`rail-sub-link${location.pathname === "/evidence" ? " active" : ""}`}
            >
              Evidence limits
            </Link>
            <Link
              to="/data-requests"
              className={`rail-sub-link${location.pathname === "/data-requests" ? " active" : ""}`}
            >
              Data requests
            </Link>
          </div>

          <div className="rail-footer">
            <button
              type="button"
              className="edition-trigger"
              onClick={() => setEditionOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="edition-trigger-label">Edition 01 ▾</span>
              <small>Long COVID · WV</small>
            </button>

            <ThemeControl />

            <small className="source-revision" aria-label="Application source revision">
              {buildIdentity.url ? (
                <a href={buildIdentity.url} target="_blank" rel="noopener noreferrer">
                  {buildIdentity.label}
                </a>
              ) : (
                buildIdentity.label
              )}
            </small>
          </div>
        </div>
      </aside>

      <div className="command-main-column">
        <DisclosureProvider>
          <main id="main-content" tabIndex={-1} data-navigation={navigationType}>
            <Outlet />
          </main>
        </DisclosureProvider>
        <footer className="command-footer">
          <span>Diagnostic Odyssey · Edition 01: Long COVID · West Virginia</span>
          <span>AHRQ MEPS · HRSA · Census ACS · Aggregate estimates only</span>
        </footer>
      </div>

      {editionOpen && createPortal(
        <EditionModal open={editionOpen} onClose={() => setEditionOpen(false)} />,
        document.body
      )}
    </div>
  );
}
