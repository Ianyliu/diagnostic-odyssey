import { useEffect, type RefObject } from "react";

/**
 * Attaches restrained IntersectionObserver reveal transitions to `[data-reveal]`
 * descendants inside `containerRef`. Elements already in view, reduced-motion
 * sessions, and environments without IntersectionObserver remain immediately visible.
 */
export function useScrollReveal(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      for (const el of targets) {
        el.dataset.reveal = "visible";
      }
      return;
    }

    const viewportHeight = window.innerHeight || 900;
    const pending: HTMLElement[] = [];

    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight * 0.94) {
        el.dataset.reveal = "visible";
      } else {
        el.dataset.reveal = "pending";
        pending.push(el);
      }
    }

    if (!pending.length) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            entry.target.dataset.reveal = "visible";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );

    for (const el of pending) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [containerRef]);
}
