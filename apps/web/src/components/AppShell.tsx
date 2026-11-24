import { useEffect, useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { workspaceStages, workspaceStageForPath } from "../data/workspaceNavigation";
import { DisclosureProvider } from "./WorkspaceDisclosure";
import "./WorkspaceNavigation.css";
import { focusTarget, scrollToFragment } from "../data/fragmentNavigation";
import { ThemeControl } from "./ThemeControl";
import { displayBuildProvenance, type BuildProvenance } from "../data/buildProvenance";

/** Replaced with a validated Git checkout identity by Vite at build time. */
declare const __DO_BUILD_PROVENANCE__: BuildProvenance;

const savedScroll = new Map<string, number>();
const advisorEnabled = import.meta.env.VITE_FUTURE_AI_EXPERIENCE_DEMO !== "off";

export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const initialRoute = useRef(true);
  const preFragmentScroll = useRef<number | null>(null);
  const lastScrollY = useRef(0);

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
    window.addEventListener("scroll", recordScroll, {passive: true});
    return () => {
      window.removeEventListener("scroll", recordScroll);
      savedScroll.set(location.key, lastScrollY.current);
    };
  }, [location.key]);

  useEffect(() => {
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
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [location.key, location.hash, navigationType]);

  const activeStage = workspaceStageForPath(location.pathname);
  const buildIdentity = displayBuildProvenance(__DO_BUILD_PROVENANCE__);
  const stages = advisorEnabled
    ? workspaceStages
    : workspaceStages.filter(stage => stage.to !== "/advisor");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Diagnostic Odyssey, Overview">
            <span className="brand-mark" aria-hidden="true">
              <img src="/diagnostic-odyssey-mark.svg" width="28" height="28" alt="" />
            </span>
            <span className="brand-copy">
              <strong>Diagnostic Odyssey</strong>
            </span>
          </Link>

          <nav id="primary-navigation" aria-label="Primary navigation" className="primary-nav">
            {stages.map(({to, label}) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={activeStage === to ? "active" : ""}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="header-controls">
            <ThemeControl />
          </div>
        </div>
      </header>
      <DisclosureProvider>
        <main id="main-content" tabIndex={-1} data-navigation={navigationType}>
          <Outlet />
        </main>
      </DisclosureProvider>
      <footer className="site-footer">
        <span>Diagnostic Odyssey · Edition 01: Long COVID · West Virginia</span>
        <span>AHRQ MEPS · HRSA · Census ACS · Aggregate only</span>
        <small className="source-revision" aria-label="Application source revision">
          {buildIdentity.url ? (
            <a href={buildIdentity.url} target="_blank" rel="noopener noreferrer">{buildIdentity.label}</a>
          ) : buildIdentity.label}
        </small>
      </footer>
    </div>
  );
}
