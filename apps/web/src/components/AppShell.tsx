import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { workspaceStages, workspaceStageForPath } from "../data/workspaceNavigation";
import { DisclosureProvider } from "./WorkspaceDisclosure";
import { EditionDrawer } from "./EditionDrawer";
import { focusTarget, scrollToFragment } from "../data/fragmentNavigation";
import { ThemeControl } from "./ThemeControl";
import { displayBuildProvenance, type BuildProvenance } from "../data/buildProvenance";

/** Replaced with a validated Git checkout identity by Vite at build time. */
declare const __DO_BUILD_PROVENANCE__: BuildProvenance;

const savedScroll = new Map<string, number>();

export function AppShell({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
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
        // Anchor focus and scrolling handled together.
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
  const advisorActive = location.pathname === "/advisor" || location.pathname === "/concept/future-ai";
  const buildIdentity = displayBuildProvenance(__DO_BUILD_PROVENANCE__);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Diagnostic Odyssey, Overview">
            <span className="brand-mark" aria-hidden="true">
              <img src="/diagnostic-odyssey-mark.svg" width="32" height="32" alt="" />
            </span>
            <strong className="brand-name">Diagnostic Odyssey</strong>
          </Link>

          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className={"primary-nav" + (menuOpen ? " open" : "")}
          >
            {workspaceStages.map(({ to, label }, index) => (
              <NavLink key={to} to={to} className={activeStage === to ? "active" : ""}>
                <span className="atlas-stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> {label}
              </NavLink>
            ))}
            <NavLink to="/data-requests" end className="atlas-requests-link">Data requests</NavLink>
          </nav>

          <div id="workspace-tools" className={"header-controls" + (menuOpen ? " open" : "")}>
            {advisorAvailable && <Link
              to="/advisor"
              className={"header-ai-pill" + (advisorActive ? " active" : "")}
              aria-label="Strategy AI Studio"
            >
              AI
            </Link>}
            <button
              type="button"
              className="edition-trigger"
              onClick={() => setEditionOpen(true)}
              aria-haspopup="dialog"
            >
              Edition 01 <span aria-hidden="true">▾</span>
            </button>
            <ThemeControl />
          </div>

          <button
            ref={menuToggle}
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation workspace-tools"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <DisclosureProvider>
        <main id="main-content" tabIndex={-1} data-navigation={navigationType}>
          <Outlet />
        </main>
      </DisclosureProvider>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>Diagnostic Odyssey · Edition 01: Long COVID (U.S.) · West Virginia</span>
          <nav className="footer-links" aria-label="Supporting navigation">
            <Link to="/evidence">Evidence</Link>
            <Link to="/data-requests">Data Requests</Link>
            {advisorAvailable && <Link to="/advisor">Strategy AI</Link>}
          </nav>
          <small className="source-revision" aria-label="Application source revision">
            {buildIdentity.url ? (
              <a href={buildIdentity.url} target="_blank" rel="noopener noreferrer">{buildIdentity.label}</a>
            ) : (
              buildIdentity.label
            )}
          </small>
        </div>
      </footer>

      <EditionDrawer open={editionOpen} onClose={() => setEditionOpen(false)} />
    </div>
  );
}
