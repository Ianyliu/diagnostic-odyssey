export type MediaQuerySource = Partial<Pick<Window, "matchMedia">> | null;

/** Browser APIs may be absent, blocked, or only partially implemented. */
export function getBrowserMediaQuery(
  query: string,
  source: MediaQuerySource = typeof window === "undefined" ? null : window
): MediaQueryList | null {
  try {
    if (typeof source?.matchMedia !== "function") return null;
    const media = source.matchMedia(query);
    return media && typeof media.matches === "boolean" ? media : null;
  } catch {
    return null;
  }
}

export function readMediaQueryMatches(media: MediaQueryList | null, fallback = false): boolean {
  try {
    return typeof media?.matches === "boolean" ? media.matches : fallback;
  } catch {
    return fallback;
  }
}

/** Subscribe only when a matching cleanup API is available. */
export function subscribeToMediaQuery(media: MediaQueryList | null, onChange: () => void): () => void {
  if (!media) return () => {};
  try {
    if (typeof media.addEventListener === "function" && typeof media.removeEventListener === "function") {
      const remove = media.removeEventListener;
      try {
        media.addEventListener("change", onChange);
      } catch {
        // A partial implementation may register before throwing.
        try { remove.call(media, "change", onChange); } catch { /* Browser cleanup unavailable. */ }
        return () => {};
      }
      return () => {
        try { remove.call(media, "change", onChange); } catch { /* Browser cleanup unavailable. */ }
      };
    }
    if (typeof media.addListener === "function" && typeof media.removeListener === "function") {
      const remove = media.removeListener;
      try {
        media.addListener(onChange);
      } catch {
        try { remove.call(media, onChange); } catch { /* Browser cleanup unavailable. */ }
        return () => {};
      }
      return () => {
        try { remove.call(media, onChange); } catch { /* Browser cleanup unavailable. */ }
      };
    }
  } catch {
    // Some embedded browsers expose throwing API getters.
  }
  return () => {};
}
