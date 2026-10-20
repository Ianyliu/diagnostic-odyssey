import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [menuOpen, setMenuOpen] = useState(false);
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
    window.addEventListener("scroll", recordScroll, {passive: true});
    return () => {
      window.removeEventListener("scroll", recordScroll);
      savedScroll.set(location.key, lastScrollY.current);
    };
  }, [location.key]);

  useEffect(() => {
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (navigationType === "POP" && savedScroll.has(location.key)) {
        // A different history entry may have closed the destination's disclosure.
        // Reveal and focus it before restoring this entry's saved position.
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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Diagnostic Odyssey, Overview">
            <span className="brand-mark" aria-hidden="true">
              <img src="/diagnostic-odyssey-icon.png" width="192" height="192" alt="" />
            </span>
            <span className="brand-copy">
              <strong>Diagnostic Odyssey</strong>
              <span>Evidence workspace</span>
            </span>
          </Link>
          <button
            ref={menuToggle}
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="workspace-tools"
            onClick={() => setMenuOpen(open => !open)}
          >{menuOpen ? "Close menu" : "Menu"}</button>
          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className={"primary-nav" + (menuOpen ? " open" : "")}
          >
            {workspaceStages.map(({to, label, shortLabel}, index) => (
              <NavLink key={to} to={to} className={activeStage === to ? "active" : ""}>
                <span className="stage-number" aria-hidden="true">{index + 1}</span>
                <span className="stage-label">{label}</span><span className="stage-short" aria-hidden="true">{shortLabel}</span>
              </NavLink>
            ))}
          </nav>
          <div id="workspace-tools" className={"header-controls" + (menuOpen ? " open" : "")} hidden={!menuOpen}>
            <nav aria-label="Supporting navigation">
              <Link to="/">Overview</Link>
              <Link to="/evidence">Intervention evidence &amp; limits</Link>
              <Link to="/data-requests">Data requests</Link>
            </nav>
            <ThemeControl />
          </div>
        </div>
      </header>
      <DisclosureProvider><main id="main-content" tabIndex={-1} data-navigation={navigationType}>
        <Outlet />
      </main></DisclosureProvider>
      <footer>
        <span>Diagnostic Odyssey</span>
        <span>Built on public federal data: AHRQ MEPS, HRSA and Census ACS · aggregate estimates only; no patient-level records</span>
        <small className="source-revision" aria-label="Application source revision">{buildIdentity.url ? <a href={buildIdentity.url} target="_blank" rel="noopener noreferrer">{buildIdentity.label}</a> : buildIdentity.label}</small>
      </footer>
    </div>
  );
}
