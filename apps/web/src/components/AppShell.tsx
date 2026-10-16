import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useArtifact } from "../data/ArtifactContext";
import { focusTarget, scrollToFragment } from "../data/fragmentNavigation";
import { ThemeControl } from "./ThemeControl";

const nav = [
  ["/", "Overview"],
  ["/burden", "Burden"],
  ["/local-context", "Local context"],
  ["/pilot", "Pilot planner"],
  ["/evidence", "Evidence"],
  ["/data-requests", "Data requests"],
  ["/brief", "Planning brief"]
] as const;

const savedScroll = new Map<string, number>();

export function AppShell() {
  const {bundle, localContextStatus} = useArtifact();
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
      <main id="main-content" tabIndex={-1} data-navigation={navigationType}>
        <Outlet />
      </main>
      <footer>
        <span>Diagnostic Odyssey</span>
        <span>No PHI · no state-specific Long COVID cost · no causal ROI claim</span>
      </footer>
    </div>
  );
}
